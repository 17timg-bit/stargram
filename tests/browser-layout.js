globalThis.viewportBefore = await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
await page.setViewportSize({width:390,height:844});
const mobile=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,canvas:document.getElementById('universe').getBoundingClientRect().toJSON(),inspector:document.querySelector('.inspector').getBoundingClientRect().toJSON(),transport:document.querySelector('.transport').getBoundingClientRect().toJSON()}));
assert.ok(mobile.scrollWidth<=mobile.width,'mobile horizontal overflow');
assert.ok(mobile.canvas.bottom<=mobile.inspector.top+1);
assert.ok(mobile.inspector.bottom<=mobile.transport.top+1);
return {mobile,screenshot:await page.screenshot({fullPage:true})};
