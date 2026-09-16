import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifestPath=path.join(root,'android/app/src/main/AndroidManifest.xml');
const mainPath=path.join(root,'android/app/src/main/java/ai/sinergy/messenger/MainActivity.java');
if(!fs.existsSync(manifestPath)||!fs.existsSync(mainPath))throw new Error('ANDROID_PROJECT_REQUIRED: run npm install && npx cap add android first');
const nativeRoot=path.join(root,'native/android/app/src/main/java/ai/sinergy/messenger');const targetRoot=path.dirname(mainPath);
for(const name of ['SynergySecurityPlugin.java','SynergyAndroidPlugin.java','SynergyP2PService.java'])fs.copyFileSync(path.join(nativeRoot,name),path.join(targetRoot,name));
let manifest=fs.readFileSync(manifestPath,'utf8');
const permissions=['android.permission.INTERNET','android.permission.ACCESS_NETWORK_STATE','android.permission.RECORD_AUDIO','android.permission.POST_NOTIFICATIONS','android.permission.FOREGROUND_SERVICE','android.permission.FOREGROUND_SERVICE_DATA_SYNC'];
for(const permission of permissions)if(!manifest.includes(permission))manifest=manifest.replace(/\s*<application\b/,`\n    <uses-permission android:name="${permission}" />\n\n    <application`);
if(!manifest.includes('android:name=".SynergyP2PService"'))manifest=manifest.replace('</application>','    <service android:name=".SynergyP2PService" android:exported="false" android:stopWithTask="true" android:foregroundServiceType="dataSync" />\n    </application>');
const activityStart=manifest.indexOf('<activity');const mainName=manifest.indexOf('android:name=".MainActivity"',activityStart);if(mainName<0)throw new Error('ANDROID_PROJECT_REQUIRED: MainActivity manifest entry missing');const activityEnd=manifest.indexOf('</activity>',mainName);if(activityEnd<0)throw new Error('ANDROID_PROJECT_REQUIRED: MainActivity closing tag missing');
const filters=`\n        <intent-filter><action android:name="android.intent.action.VIEW"/><category android:name="android.intent.category.DEFAULT"/><category android:name="android.intent.category.BROWSABLE"/><data android:scheme="synergy" android:host="contact"/></intent-filter>\n        <intent-filter><action android:name="android.intent.action.VIEW"/><category android:name="android.intent.category.DEFAULT"/><category android:name="android.intent.category.BROWSABLE"/><data android:scheme="synergy" android:host="chat"/></intent-filter>\n        <intent-filter><action android:name="android.intent.action.SEND"/><category android:name="android.intent.category.DEFAULT"/><data android:mimeType="text/plain"/><data android:mimeType="image/*"/><data android:mimeType="video/*"/><data android:mimeType="audio/*"/><data android:mimeType="application/pdf"/><data android:mimeType="application/octet-stream"/></intent-filter>\n      `;
if(!manifest.includes('android:scheme="synergy"'))manifest=manifest.slice(0,activityEnd)+filters+manifest.slice(activityEnd);
fs.writeFileSync(manifestPath,manifest);
let main=fs.readFileSync(mainPath,'utf8');if(!main.includes('registerPlugin(SynergySecurityPlugin.class)')){
  if(!main.includes('import android.os.Bundle;'))main=main.replace(/(package[^;]+;)/,'$1\n\nimport android.os.Bundle;');
  const close=main.lastIndexOf('}');if(close<0)throw new Error('ANDROID_PROJECT_REQUIRED: invalid MainActivity.java');
  const method=`\n  @Override\n  public void onCreate(Bundle savedInstanceState) {\n    registerPlugin(SynergySecurityPlugin.class);\n    registerPlugin(SynergyAndroidPlugin.class);\n    super.onCreate(savedInstanceState);\n  }\n`;
  main=main.slice(0,close)+method+main.slice(close);fs.writeFileSync(mainPath,main);
}
console.log('Android hardening overlay applied');
