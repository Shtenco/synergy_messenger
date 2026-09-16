function hash32(s){let h=2166136261;for(const ch of new TextEncoder().encode(s)){h^=ch;h=Math.imul(h,16777619)>>>0;}return h>>>0;}
export function rankCommitCoordinators({groupId,epoch,adminDeviceIds}={}){const ids=[...new Set((adminDeviceIds||[]).filter(Boolean))];if(!groupId||!Number.isInteger(epoch)||!ids.length)throw new Error('GROUP_COORDINATOR_INPUT_INVALID');return ids.sort((a,b)=>{const ha=hash32(`${groupId}|${epoch}|${a}`),hb=hash32(`${groupId}|${epoch}|${b}`);return ha-hb||a.localeCompare(b);});}
export function electCommitCoordinator(input){return rankCommitCoordinators(input)[0];}
export function failoverCommitCoordinator(input,failed=[]){const blocked=new Set(failed);return rankCommitCoordinators(input).find(id=>!blocked.has(id))||null;}
