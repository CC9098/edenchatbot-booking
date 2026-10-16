import { test, expect } from '@playwright/test';
import { createAuthenticatedContext, createAuthenticatedApiContext } from './helpers/auth';
import { getBaseUrl } from './helpers/env';
test.use({ trace:'off', video:'off' });
test('anonymous, non-staff, cross-origin and cron authentication are enforced', async ({request}) => {
  expect((await request.get('/api/staff/ig-news')).status()).toBe(401);
  expect((await request.post('/api/staff/ig-news')).status()).toBe(401);
  expect((await request.get('/api/cron/ig-news')).status()).toBe(401);
  const outsider=await createAuthenticatedApiContext('patient');
  try { expect((await outsider.get('/api/staff/ig-news')).status()).toBe(403); expect((await outsider.post('/api/staff/ig-news')).status()).toBe(403); } finally {await outsider.dispose();}
  const staff=await createAuthenticatedApiContext('doctor');
  try { expect((await staff.post('/api/staff/ig-news',{headers:{origin:'https://evil.example'}})).status()).toBe(403); } finally {await staff.dispose();}
});
test('staff UI handles loading, success, errors and mobile layout', async({browser})=>{
  const context=await createAuthenticatedContext(browser,'doctor');
  try {
    const page=await context.newPage(); let fail=false;
    const snapshot={items:[],updatedAt:'2026-10-16T12:00:00Z',attemptedAt:'2026-10-16T12:00:00Z',error:null,source:'manual'};
    await page.route('**/api/staff/ig-news',async route=>{
      if(route.request().method()==='POST') {
        await new Promise(resolve=>setTimeout(resolve,300));
        await route.fulfill({status:fail?502:200,json:fail?{error:'同步失敗，請稍後再試。'}:{...snapshot,success:true}});
      } else await route.fulfill({json:snapshot});
    });
    await page.goto('/nurse/ig-news');
    const button=page.getByRole('button',{name:'同步 IG 消息',exact:true}); await expect(button).toBeEnabled();
    await button.click(); await expect(page.getByRole('button',{name:'同步中…'})).toBeDisabled();
    await expect(page.getByRole('status')).toContainText('同步成功，暫無符合條件的消息。');
    fail=true; await button.click(); await expect(page.getByRole('alert').filter({hasText:'同步失敗'})).toContainText('同步失敗');
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:'output/ig-news-mobile.png',fullPage:true});
  } finally { await context.close(); }
});
test('real staff sync reads IG and persists status across reload', async({browser,request})=>{
  test.skip(process.env.RUN_IG_SYNC!=='1','Explicit sync run only');
  const context=await createAuthenticatedContext(browser,'doctor');
  try {
    const page=await context.newPage(); await page.goto('/nurse/ig-news');
    const button=page.getByRole('button',{name:'同步 IG 消息',exact:true}); await expect(button).toBeEnabled();
    const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/staff/ig-news')&&r.request().method()==='POST');
    await button.click(); const response=await responsePromise; expect(response.status()).toBe(200);
    const snapshot=await response.json(); expect(snapshot.success).toBe(true); expect(Date.parse(snapshot.updatedAt)).toBeGreaterThan(Date.now()-120000);
    await expect(page.getByRole('status')).toContainText('同步成功');
    await page.reload(); await expect(button).toBeEnabled();
    const readback=await context.request.get('/api/staff/ig-news'); expect((await readback.json()).updatedAt).toBe(snapshot.updatedAt);
    const publicResponse=await request.get('/api/public/latest-news',{headers:{origin:'https://www.edenclinic.hk'}});
    expect(publicResponse.headers()['access-control-allow-origin']).toBe('https://www.edenclinic.hk');
    expect((await publicResponse.json()).items).toEqual(snapshot.items);
    const again=await context.request.post('/api/staff/ig-news',{headers:{origin:new URL(getBaseUrl()).origin}});expect(again.status()).toBe(409);
    await page.screenshot({path:'output/ig-news-real-sync.png',fullPage:true});
  } finally {await context.close();}
});
