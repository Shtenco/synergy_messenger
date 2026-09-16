import { openSynergyDb } from '../src/v3/storage/db.js';
import { WebCryptoProvider } from '../src/v3/crypto/webcrypto-provider.js';
import { IdentityManager } from '../src/v3/crypto/identity/identity-manager.js';
import { TrustStore } from '../src/v3/crypto/identity/trust-store.js';
import { PreKeyManager } from '../src/v3/crypto/prekeys/prekey-manager.js';
import { KeyRepository } from '../src/v3/crypto/storage/key-repository.js';
import { Vault } from '../src/v3/crypto/storage/vault.js';
import { SessionRepository } from '../src/v3/crypto/storage/session-repository.js';
import { DoubleRatchet } from '../src/v3/crypto/ratchet/double-ratchet.js';
import { CryptoEngine } from '../src/v3/crypto/crypto-engine.js';
import { SecureMessengerCore } from '../src/v3/secure-messenger-core.js';
import { createDefaultP2PCore, createDefaultMediaPlane, createFinanceBridge, createPhase6Hardening } from '../src/v3/index.js';
import { ContactRepository } from '../src/v3/ui/contact-repository.js';
import { ConversationRepository } from '../src/v3/ui/conversation-repository.js';
import { HistoryRepository } from '../src/v3/ui/history-repository.js';
import { MessengerController } from '../src/v3/ui/messenger-controller.js';
import { encodeContactCard, formatPublicId } from '../src/v3/ui/contact-card.js';
import { createPublicIdQrMatrix, qrMatrixToSvg } from '../src/v3/ui/public-id-qr.js';
import { BrowserVoiceRecorder } from '../src/v3/voice/browser-voice-recorder.js';
import { OpenMlsProvider } from '../src/v3/groups/openmls-provider.js';
import { GroupRepository } from '../src/v3/groups/group-repository.js';
import { GroupService } from '../src/v3/groups/group-service.js';
import { GroupMessagingCore } from '../src/v3/groups/group-messaging-core.js';
import { GroupController } from '../src/v3/groups/group-controller.js';
import { UnifiedMessengerController } from '../src/v3/groups/unified-messenger-controller.js';
import { NativeSecurityVault } from '../src/v3/platform/native-security-vault.js';
import { AndroidRuntimeBridge } from '../src/v3/platform/android-runtime-bridge.js';

export async function createBrowserV3Runtime({
  wakuSdk = globalThis.SYNERGY_WAKU_SDK || null,
  mlsBackend = globalThis.SYNERGY_OPENMLS_BACKEND || null,
  financeProvider = globalThis.SYNERGY_FINANCE_BRIDGE || null,
  replicaProviders = globalThis.SYNERGY_REPLICA_PROVIDERS || [],
  phase6Security = {},
  nativeSecurityPlugin = globalThis.SYNERGY_NATIVE_SECURITY || globalThis.Capacitor?.Plugins?.SynergySecurity || null,
  androidPlugin = globalThis.SYNERGY_ANDROID_BRIDGE || globalThis.Capacitor?.Plugins?.SynergyAndroid || null,
  platform = globalThis.Capacitor?.getPlatform?.() || 'web',
  networkConfig,
  allowOffline = true,
  openDb = openSynergyDb,
  clock = { now:()=>Date.now() }
} = {}) {
  const db = await openDb();
  const provider = new WebCryptoProvider({ crypto:globalThis.crypto });
  const identityManager = new IdentityManager({ db, provider, clock });
  const trustStore = new TrustStore(db);
  const preKeyManager = new PreKeyManager({ db, provider, identityManager, clock });
  const keyRepository = new KeyRepository(db);
  let vault, nativeSecurityStatus={available:false,mode:'webcrypto',migrationRequired:false}, androidBridge=null;
  if (platform === 'android') {
    if (!nativeSecurityPlugin) throw new Error('ANDROID_SECURITY_PLUGIN_REQUIRED');
    if (!androidPlugin) throw new Error('ANDROID_RUNTIME_PLUGIN_REQUIRED');
    const nativeVault = new NativeSecurityVault({ plugin:nativeSecurityPlugin });
    const status = await nativeVault.status();
    const legacy = await keyRepository.get('vault-v1');
    if (legacy?.key) {
      vault = new Vault({ keyRepository, provider });
      nativeSecurityStatus={...status,available:true,mode:'legacy-webcrypto',migrationRequired:true};
    } else {
      vault = nativeVault;
      nativeSecurityStatus={...status,available:true,mode:'android-keystore',migrationRequired:false};
    }
    androidBridge = new AndroidRuntimeBridge({ plugin:androidPlugin });
  } else {
    vault = new Vault({ keyRepository, provider });
  }
  const phase6 = createPhase6Hardening({ db, vault, cryptoProvider:provider, clock, replicaProviders, security:phase6Security });
  const sessionRepository = new SessionRepository({ db, vault, clock });
  const ratchet = new DoubleRatchet({ provider });
  const cryptoEngine = new CryptoEngine({ db, provider, identityManager, trustStore, preKeyManager, sessionRepository, ratchet, clock });
  const identity = await cryptoEngine.initialize();
  const p2pCore = createDefaultP2PCore({
    localMailbox:identity.mailbox,
    senderDeviceId:identity.deviceId,
    sdk:wakuSdk,
    networkConfig,
    db,
    clock,
    ingressGuard:phase6.ingressGuard
  });
  const secureCore = new SecureMessengerCore({ p2pCore, cryptoEngine, clock });
  const mediaPlane = createDefaultMediaPlane({
    db,
    provider,
    vault,
    direct:p2pCore.transport.direct,
    replicaProvider:phase6.replicaCoordinator,
    clock
  });
  const contacts=new ContactRepository(db);
  const history=new HistoryRepository({ db, vault });
  const directController = new MessengerController({
    secureCore,
    mediaManager:mediaPlane.manager,
    contacts,
    conversations:new ConversationRepository(db),
    history,
    clock
  });
  await directController.start({ allowOffline });

  let groupProvider=null,groupService=null,groupCore=null,groupController=null,groupError=null,mlsKeyPackage=null;
  if (mlsBackend) {
    try {
      groupProvider=new OpenMlsProvider({backend:mlsBackend});
      mlsKeyPackage=await groupProvider.createKeyPackage({deviceId:identity.deviceId,identity});
      groupService=new GroupService({repository:new GroupRepository({db,vault}),provider:groupProvider,localDeviceId:identity.deviceId,clock});
      groupCore=new GroupMessagingCore({p2pCore,groupService,localDeviceId:identity.deviceId,clock});
      groupController=new GroupController({groupCore,groupService,secureCore,contacts,history,mediaManager:mediaPlane.manager,clock});
      await groupController.start();
    } catch (error) {
      groupError=error;
      try { await groupController?.stop?.(); } catch {}
      groupProvider=groupService=groupCore=groupController=null;
      mlsKeyPackage=null;
    }
  }
  const controller=new UnifiedMessengerController({directController,groupController});
  let financeController=null,financeRepository=null,financeCapabilities={available:false,assets:[]},financeError=null;
  try {
    const finance=createFinanceBridge({db,vault,messenger:controller,localDeviceId:identity.deviceId,provider:financeProvider,clock});
    financeController=finance.controller;
    financeRepository=finance.repository;
    financeCapabilities=await financeController.capabilities();
  } catch (error) {
    financeError=error;
    const finance=createFinanceBridge({db,vault,messenger:controller,localDeviceId:identity.deviceId,provider:null,clock});
    financeController=finance.controller;
    financeRepository=finance.repository;
    financeCapabilities={available:false,assets:[]};
  }
  const voiceRecorder = new BrowserVoiceRecorder();
  const bundle = await secureCore.getPublicBundle({ oneTimeCount:0 });
  const publicId = formatPublicId(identity);
  const invite = encodeContactCard({ name:'', bundle, mlsKeyPackage });
  return {
    db, provider, identity, bundle, publicId, invite, controller, directController, groupController, groupService, groupCore, groupProvider, groupsAvailable:controller.groupsAvailable, groupError, secureCore, mediaPlane, voiceRecorder,
    financeController, financeRepository, financeCapabilities, financeAvailable:!!financeCapabilities.available, financeError,
    platform, nativeSecurityStatus, androidBridge, phase6, securityDiagnostics:phase6.diagnostics, securityMaintenance:phase6.maintenance, replicasAvailable:!!phase6.replicaCoordinator,
    networkOnline:secureCore.started && !directController.networkError,
    networkError:directController.networkError,
    publicQrSvg:qrMatrixToSvg(createPublicIdQrMatrix(publicId), { scale:5, border:4 })
  };
}
