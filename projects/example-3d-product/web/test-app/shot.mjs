import { chromium } from 'playwright-core'
const b = await chromium.launch({ args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport:{width:1280,height:720} })
const logs=[]; p.on('console',m=>logs.push(m.type()+': '+m.text())); p.on('pageerror',e=>logs.push('PAGEERR '+e.message))
await p.goto('http://localhost:5199'); await p.waitForTimeout(8000)
await p.screenshot({ path: process.argv[2] })
console.log(logs.join('\n')); await b.close()
