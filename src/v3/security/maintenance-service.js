export class MaintenanceService{
  constructor({jobs=[],clock={now:()=>Date.now()}}={}){this.jobs=jobs;this.clock=clock;}
  async runOnce(){const now=this.clock.now(),results=[];for(const job of this.jobs){try{results.push({name:job.name||'job',ok:true,result:await job.run(now)});}catch(error){results.push({name:job.name||'job',ok:false,error:error?.message||String(error)});}}return results;}
}
