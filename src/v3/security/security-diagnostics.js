export class SecurityDiagnostics{
  constructor({db}={}){if(!db)throw new Error('SECURITY_DIAGNOSTICS_DB_REQUIRED');this.db=db;}
  async snapshot(){const stores=['messages','outbox','inbox','sessions','mediaObjects','mediaTransfers','groups','payments','deviceCertificates','deviceRevocations','replicaCapabilities','securityReplay'];const counts={};for(const s of stores){try{counts[s]=(await this.db.getAll(s)).length;}catch{counts[s]=null;}}return {version:1,counts};}
}
