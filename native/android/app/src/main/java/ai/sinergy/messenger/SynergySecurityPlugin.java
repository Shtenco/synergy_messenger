package ai.sinergy.messenger;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.KeyStore;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "SynergySecurity")
public class SynergySecurityPlugin extends Plugin {
  private static final String STORE = "AndroidKeyStore";
  private static final String ALIAS = "synergy-messenger-vault-v1";
  private static final String CIPHER = "AES/GCM/NoPadding";
  private static final int B64 = Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING;

  private SecretKey key() throws Exception {
    KeyStore ks = KeyStore.getInstance(STORE); ks.load(null);
    if (ks.containsAlias(ALIAS)) return (SecretKey) ks.getKey(ALIAS, null);
    KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, STORE);
    KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .setRandomizedEncryptionRequired(true);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) builder.setUnlockedDeviceRequired(true);
    generator.init(builder.build());
    return generator.generateKey();
  }

  private static byte[] dec(String value) { return value == null || value.isEmpty() ? new byte[0] : Base64.decode(value, B64); }
  private static String enc(byte[] value) { return Base64.encodeToString(value, B64); }

  @PluginMethod public void securityStatus(PluginCall call) {
    try {
      SecretKey secret = key(); boolean hardware = false;
      try { KeyInfo info = (KeyInfo) SecretKeyFactory.getInstance(secret.getAlgorithm(), STORE).getKeySpec(secret, KeyInfo.class); hardware = info.isInsideSecureHardware(); } catch (Exception ignored) {}
      JSObject out = new JSObject(); out.put("available", true); out.put("hardwareBacked", hardware); out.put("keystore", STORE); call.resolve(out);
    } catch (Exception e) { call.reject("ANDROID_KEYSTORE_UNAVAILABLE", e); }
  }

  @PluginMethod public void seal(PluginCall call) {
    try {
      byte[] plaintext = dec(call.getString("plaintextBase64", "")); byte[] aad = dec(call.getString("aadBase64", ""));
      Cipher cipher = Cipher.getInstance(CIPHER); cipher.init(Cipher.ENCRYPT_MODE, key(), new SecureRandom()); if (aad.length > 0) cipher.updateAAD(aad);
      byte[] ciphertext = cipher.doFinal(plaintext); JSObject out = new JSObject(); out.put("version", 1); out.put("ivBase64", enc(cipher.getIV())); out.put("ciphertextBase64", enc(ciphertext)); call.resolve(out);
    } catch (Exception e) { call.reject("ANDROID_KEYSTORE_SEAL_FAILED", e); }
  }

  @PluginMethod public void open(PluginCall call) {
    try {
      byte[] iv = dec(call.getString("ivBase64", "")); byte[] ciphertext = dec(call.getString("ciphertextBase64", "")); byte[] aad = dec(call.getString("aadBase64", ""));
      if (iv.length != 12 || ciphertext.length < 16) { call.reject("ANDROID_KEYSTORE_BLOB_INVALID"); return; }
      Cipher cipher = Cipher.getInstance(CIPHER); cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv)); if (aad.length > 0) cipher.updateAAD(aad);
      JSObject out = new JSObject(); out.put("plaintextBase64", enc(cipher.doFinal(ciphertext))); call.resolve(out);
    } catch (Exception e) { call.reject("ANDROID_KEYSTORE_OPEN_FAILED", e); }
  }

  @PluginMethod public void deleteVaultKey(PluginCall call) {
    try { KeyStore ks = KeyStore.getInstance(STORE); ks.load(null); if (ks.containsAlias(ALIAS)) ks.deleteEntry(ALIAS); call.resolve(); }
    catch (Exception e) { call.reject("ANDROID_KEYSTORE_DELETE_FAILED", e); }
  }
}
