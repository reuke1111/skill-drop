Promise.all([
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}),
  chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'})
]).catch(async()=>{
  await chrome.action.setBadgeText({text:'!'});
  await chrome.action.setTitle({title:'Skill Drop could not initialize. Reload the extension.'});
}).catch(()=>undefined);
