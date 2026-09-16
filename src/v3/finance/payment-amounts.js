const HUMAN_RE=/^[0-9]+(?:\.[0-9]+)?$/;
const ATOMIC_RE=/^(0|[1-9][0-9]*)$/;

function assertDecimals(decimals){if(!Number.isInteger(decimals)||decimals<0||decimals>18)throw new Error('PAYMENT_DECIMALS_INVALID');}

export function parseUnits(value,decimals){
  assertDecimals(decimals);
  if(typeof value!=='string'||!HUMAN_RE.test(value))throw new Error('PAYMENT_HUMAN_AMOUNT_INVALID');
  const [wholeRaw,fractionRaw='']=value.split('.');
  if(fractionRaw.length>decimals)throw new Error('PAYMENT_HUMAN_AMOUNT_PRECISION');
  const whole=wholeRaw.replace(/^0+(?=\d)/,'')||'0';
  const fraction=fractionRaw.padEnd(decimals,'0');
  const atomic=(whole+fraction).replace(/^0+(?=\d)/,'')||'0';
  if(!ATOMIC_RE.test(atomic)||atomic==='0')throw new Error('PAYMENT_AMOUNT_INVALID');
  return atomic;
}

export function formatUnits(value,decimals){
  assertDecimals(decimals);
  if(typeof value!=='string'||!ATOMIC_RE.test(value))throw new Error('PAYMENT_AMOUNT_INVALID');
  if(decimals===0)return value;
  const padded=value.padStart(decimals+1,'0');
  const whole=padded.slice(0,-decimals)||'0';
  const fraction=padded.slice(-decimals).replace(/0+$/,'');
  return fraction?`${whole}.${fraction}`:whole;
}
