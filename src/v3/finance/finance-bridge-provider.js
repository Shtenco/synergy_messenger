export function assertFinanceBridgeProvider(provider){
  if(!provider)return false;
  for(const method of ['getCapabilities','preview','authorizeAndSubmit','refresh','verifyReceipt'])if(typeof provider[method]!=='function')throw new Error('FINANCE_PROVIDER_INVALID');
  for(const forbidden of ['getPrivateKey','exportPrivateKey','signTransaction','signRawTransaction','importPrivateKey'])if(typeof provider[forbidden]==='function')throw new Error('FINANCE_PROVIDER_UNSAFE_API');
  return true;
}
