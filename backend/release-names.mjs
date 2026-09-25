const packages={
  darwin:{suffix:'macOS-arm64.dmg',legacy:'Nodus-mac-arm64.dmg'},
  win32:{suffix:'Windows-x64.exe',legacy:'Nodus-windows-x64.exe'},
  linux:{suffix:'Linux-x86_64.AppImage',legacy:'Nodus-linux-x64.AppImage'},
};

export function releaseAssetName(platform,tag){
  if(!packages[platform])throw new Error('Unsupported release platform');
  if(!/^v\d+\.\d+\.\d+$/.test(tag))throw new Error('Invalid release tag');
  return `Nodus-${tag}-${packages[platform].suffix}`;
}

export function legacyAssetName(platform){
  if(!packages[platform])throw new Error('Unsupported release platform');
  return packages[platform].legacy;
}
