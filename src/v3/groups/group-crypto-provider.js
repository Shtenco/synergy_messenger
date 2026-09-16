export class GroupCryptoProvider{
  async createKeyPackage(){throw new Error('MLS_PROVIDER_NOT_IMPLEMENTED');}
  async createGroup(){throw new Error('MLS_PROVIDER_NOT_IMPLEMENTED');}
  async joinGroup(){throw new Error('MLS_PROVIDER_NOT_IMPLEMENTED');}
  async addMembers(){throw new Error('MLS_PROVIDER_NOT_IMPLEMENTED');}
  async removeMembers(){throw new Error('MLS_PROVIDER_NOT_IMPLEMENTED');}
  async processCommit(){throw new Error('MLS_PROVIDER_NOT_IMPLEMENTED');}
  async encryptApplication(){throw new Error('MLS_PROVIDER_NOT_IMPLEMENTED');}
  async decryptMessage(){throw new Error('MLS_PROVIDER_NOT_IMPLEMENTED');}
  async exportState(){throw new Error('MLS_PROVIDER_NOT_IMPLEMENTED');}
  async importState(){throw new Error('MLS_PROVIDER_NOT_IMPLEMENTED');}
  async exportSecret(){throw new Error('MLS_PROVIDER_NOT_IMPLEMENTED');}
}
