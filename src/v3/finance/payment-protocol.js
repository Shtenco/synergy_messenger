const ASSET_RE=/^[A-Z0-9][A-Z0-9._-]{1,23}$/;
const NETWORK_RE=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const ATOMIC_RE=/^(0|[1-9][0-9]*)$/;
const RECEIPT_STATES=new Set(['submitted','confirmed','failed','cancelled','expired']);

function reqString(value,code,max=256){if(typeof value!=='string'||!value||value.length>max)throw new Error(code);return value;}
function amount(value){if(typeof value!=='string'||!ATOMIC_RE.test(value)||value==='0')throw new Error('PAYMENT_AMOUNT_INVALID');return value;}
function decimals(value){if(!Number.isInteger(value)||value<0||value>18)throw new Error('PAYMENT_DECIMALS_INVALID');return value;}
export function validatePaymentIntent(intent){
  if(!intent||intent.version!==1)throw new Error('PAYMENT_INTENT_VERSION_INVALID');
  reqString(intent.paymentId,'PAYMENT_ID_INVALID',128);reqString(intent.chatId,'PAYMENT_CHAT_INVALID',256);reqString(intent.payerDeviceId,'PAYMENT_PAYER_INVALID',256);reqString(intent.payeeRef,'PAYMENT_PAYEE_INVALID',512);reqString(intent.nonce,'PAYMENT_NONCE_INVALID',256);
  if(typeof intent.asset!=='string'||!ASSET_RE.test(intent.asset))throw new Error('PAYMENT_ASSET_INVALID');
  if(typeof intent.network!=='string'||!NETWORK_RE.test(intent.network))throw new Error('PAYMENT_NETWORK_INVALID');
  amount(intent.amountAtomic);decimals(intent.decimals);
  if(intent.memo!=null&&(typeof intent.memo!=='string'||intent.memo.length>500))throw new Error('PAYMENT_MEMO_INVALID');
  if(!Number.isFinite(intent.createdAt))throw new Error('PAYMENT_CREATED_AT_INVALID');
  if(!Number.isFinite(intent.expiresAt)||intent.expiresAt<=intent.createdAt)throw new Error('PAYMENT_EXPIRY_INVALID');
  return intent;
}
export function validatePaymentReceipt(receipt){
  if(!receipt||receipt.version!==1)throw new Error('PAYMENT_RECEIPT_VERSION_INVALID');
  reqString(receipt.paymentId,'PAYMENT_ID_INVALID',128);
  if(!RECEIPT_STATES.has(receipt.status))throw new Error('PAYMENT_RECEIPT_STATUS_INVALID');
  if(typeof receipt.asset!=='string'||!ASSET_RE.test(receipt.asset))throw new Error('PAYMENT_ASSET_INVALID');
  if(typeof receipt.network!=='string'||!NETWORK_RE.test(receipt.network))throw new Error('PAYMENT_NETWORK_INVALID');
  amount(receipt.amountAtomic);decimals(receipt.decimals);
  if(receipt.txRef!=null&&(typeof receipt.txRef!=='string'||receipt.txRef.length>512))throw new Error('PAYMENT_TX_REF_INVALID');
  if(receipt.providerRef!=null&&(typeof receipt.providerRef!=='string'||receipt.providerRef.length>128))throw new Error('PAYMENT_PROVIDER_REF_INVALID');
  if(!Number.isFinite(receipt.createdAt)||!Number.isFinite(receipt.updatedAt)||receipt.updatedAt<receipt.createdAt)throw new Error('PAYMENT_RECEIPT_TIME_INVALID');
  return receipt;
}
export function validatePaymentEvent(event){
  if(!event||event.version!==1||!['request','receipt','status'].includes(event.kind))throw new Error('PAYMENT_EVENT_INVALID');
  if(event.kind==='request')validatePaymentIntent(event.intent);
  if(event.kind==='receipt') {validatePaymentIntent(event.intent);validatePaymentReceipt(event.receipt);if(event.intent.paymentId!==event.receipt.paymentId)throw new Error('PAYMENT_EVENT_BINDING_INVALID');}
  if(event.kind==='status'){reqString(event.paymentId,'PAYMENT_ID_INVALID',128);if(!RECEIPT_STATES.has(event.status))throw new Error('PAYMENT_RECEIPT_STATUS_INVALID');}
  return event;
}
