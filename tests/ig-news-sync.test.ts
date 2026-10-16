import { test } from 'node:test';
import assert from 'node:assert/strict';
import { synchronizeNews, publicNews, fetchIgMedia, downloadNewsImage, EMPTY_NEWS, type NewsSyncDependencies, type NewsSnapshot } from '../lib/ig-news-sync';
import { selectLatestNews, mediaImage, type IgMedia } from '../lib/ig-latest-news';
const post: IgMedia = { id:'123', caption:'門診時間\n#醫天圓消息#置頂', media_type:'IMAGE', media_url:'https://s.cdninstagram.com/test.jpg', permalink:'https://www.instagram.com/p/test/', timestamp:new Date().toISOString() };
function fixture(media: IgMedia[] = [post]) {
  let state: NewsSnapshot = { ...EMPTY_NEWS };
  const deps: NewsSyncDependencies = {
    claim: async () => true,
    finish: async (_, snapshot) => { state = snapshot; },
    fail: async (_, message) => { state = { ...state, error: message }; },
    read: async () => state,
    fetchMedia: async () => media,
    cacheImage: async () => 'https://storage.example/cached.jpg',
  };
  return { deps, read: () => state };
}
test('manual sync persists cached images and reads back success; empty feed clears prior items', async () => {
  const f = fixture();
  const result = await synchronizeNews(f.deps,'run','manual','staff');
  assert.equal(result.items.length,1); assert.equal(result.items[0].pin,true);
  assert.equal(result.items[0].img,'https://storage.example/cached.jpg');
  assert.equal(result.source,'manual'); assert.ok(result.updatedAt);
  f.deps.fetchMedia = async () => [];
  assert.deepEqual((await synchronizeNews(f.deps,'next','daily',null)).items,[]);
});
test('failed fetch or image cache preserves previous successful snapshot but public feed hides it', async () => {
  for (const stage of ['fetchMedia','cacheImage'] as const) {
    const f = fixture(); const before = await synchronizeNews(f.deps,'run','manual','staff');
    f.deps[stage] = async () => { throw Error('private secret'); };
    await assert.rejects(synchronizeNews(f.deps,'next','daily',null), e => e instanceof Error && !e.message.includes('secret'));
    assert.deepEqual(f.read().items,before.items); assert.equal(f.read().updatedAt,before.updatedAt);
    assert.deepEqual(publicNews(f.read()).items,[]);
  }
});
test('concurrent sync is rejected before Meta access', async () => {
  const f=fixture(); f.deps.claim=async()=>false;
  f.deps.fetchMedia=async()=>{assert.fail('must not call Meta');};
  await assert.rejects(synchronizeNews(f.deps,'run','manual','staff'), {status:409});
});
test('a successful write without durable readback is not reported as success', async () => {
  const f=fixture(); f.deps.read=async()=>{throw Error('database offline');};
  await assert.rejects(synchronizeNews(f.deps,'run','manual','staff'), {status:502});
});
test('feed expires ordinary announcements at read time and retains pins', () => {
  const items=selectLatestNews([post]);
  const old={...items[0],pin:false,date:'2020-01-01'};
  assert.deepEqual(publicNews({...EMPTY_NEWS,items:[old,items[0]]}).items,items);
});
test('exact adjacent tags, punctuation, invalid dates, unsafe links and carousel video thumbnail', () => {
  assert.equal(selectLatestNews([{...post,caption:'公告\n#醫天圓消息，#置頂'}]).length,1);
  assert.equal(selectLatestNews([{...post,caption:'公告\n#醫天圓消息分享'}]).length,0);
  assert.equal(selectLatestNews([{...post,timestamp:'invalid'}]).length,0);
  assert.equal(selectLatestNews([{...post,permalink:'javascript:alert(1)'}]).length,0);
  assert.equal(mediaImage({id:'1',media_type:'CAROUSEL_ALBUM',children:{data:[{media_type:'VIDEO',media_url:'video.mp4',thumbnail_url:'thumb.jpg'}]}}),'thumb.jpg');
});
test('Meta pagination uses fixed host and bearer header, including older pinned posts', async () => {
  let calls=0;
  const fake: typeof fetch=async(input,init)=>{
    const url=new URL(String(input)); assert.equal(url.hostname,'graph.facebook.com');
    assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer private-token');
    assert.equal(url.searchParams.has('access_token'),false);
    calls++;
    if(calls===1) return Response.json({data:[],paging:{next:'https://evil.example/?access_token=private-token',cursors:{after:'next-cursor'}}});
    assert.equal(url.searchParams.get('after'),'next-cursor');
    return Response.json({data:[post]});
  };
  assert.deepEqual(await fetchIgMedia('private-token',fake),[post]); assert.equal(calls,2);
});
test('invalid pagination / Meta response fails instead of publishing partial data', async () => {
  await assert.rejects(fetchIgMedia('token',async()=>Response.json({data:[post],paging:{next:'next'}})));
  await assert.rejects(fetchIgMedia('token',async()=>Response.json({error:'bad'})));
  await assert.rejects(fetchIgMedia('token',async()=>new Response('',{status:401})));
});
test('image download restricts host, redirects, MIME, empty and oversized content', async () => {
  let calls=0;
  const fake: typeof fetch=async(_,init)=>{calls++;assert.equal(init?.redirect,'error');return new Response(new Uint8Array([1,2]),{headers:{'content-type':'image/jpeg'}});};
  for(const url of ['http://s.cdninstagram.com/a','https://evil.example/a','https://fbcdn.net.evil.example/a','https://user:pw@fbcdn.net/a']) await assert.rejects(downloadNewsImage(url,fake));
  assert.equal(calls,0);
  assert.equal((await downloadNewsImage('https://s.fbcdn.net/a',fake)).bytes.length,2);
  for(const [body,type] of [[new Uint8Array([1]),'text/html'],[new Uint8Array(0),'image/jpeg'],[new Uint8Array(10*1024*1024+1),'image/jpeg']] as const) {
    await assert.rejects(downloadNewsImage('https://s.fbcdn.net/a',async()=>new Response(body,{headers:{'content-type':type}})));
  }
});
