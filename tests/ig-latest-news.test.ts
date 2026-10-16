import assert from 'node:assert/strict';

import { captionTitle, selectLatestNews, type IgMedia } from '../lib/ig-latest-news';

const now = new Date('2026-10-16T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 864e5).toISOString().replace('Z', '+0000');
const post = (id: string, caption: string, age: number, extra: Partial<IgMedia> = {}): IgMedia => ({
  id,
  caption,
  media_type: 'IMAGE',
  media_url: `https://cdn.example/${id}.jpg`,
  permalink: `https://www.instagram.com/p/${id}/`,
  timestamp: daysAgo(age),
  ...extra,
});

// 標題：去 hashtag 同開頭裝飾；「：」結尾接下一句；太長截斷
assert.equal(captionTitle('***❗️更新：\n[ 2/10(五) 佐敦店上午營業，下午休息 ] \n\n#10月門診日程表 🗓️'), '更新：2/10(五) 佐敦店上午營業，下午休息');
assert.equal(captionTitle('新加盟：張敏言醫師\n內容 #醫天圓消息'), '新加盟：張敏言醫師');
assert.equal(captionTitle('#醫天圓消息\n\nWhatsApp 新號碼：佐敦 5929 3042'), 'WhatsApp 新號碼：佐敦 5929 3042');
assert.equal(captionTitle('一'.repeat(50)).length, 40);
assert.equal(captionTitle('#只有標籤'), '');
assert.equal(captionTitle('✂️【 切除就一勞永逸？中醫提醒'), '切除就一勞永逸？中醫提醒');
assert.equal(captionTitle('📢 十月門診時間 🗓️'), '十月門診時間 🗓️');

const media: IgMedia[] = [
  post('daily', '養生貼士：秋燥飲食\n#中醫', 1),
  post('new1', '新加盟：張敏言醫師\n#醫天圓消息', 5),
  post('old', '舊消息\n#醫天圓消息', 90),
  post('pinOld', 'WhatsApp 新號碼\n#醫天圓消息 #置頂', 120),
  post('new2', '十月門診時間更新\n#醫天圓消息', 2),
  post('new3', '冬至休診\n#醫天圓消息', 3),
  post('carousel', '天灸預約開始\n#醫天圓消息', 4, {
    media_type: 'CAROUSEL_ALBUM',
    media_url: undefined,
    children: { data: [{ media_type: 'IMAGE', media_url: 'https://cdn.example/c1.jpg' }] },
  }),
  post('noimg', '冇圖\n#醫天圓消息', 1, { media_url: undefined }),
  post('similar', '相似標籤\n#醫天圓消息分享', 1),
];

const items = selectLatestNews(media, { now });
// 置頂排第一（唔受 60 日限制）；其餘按新至舊；最多三則；冇 #醫天圓消息、超過 60 日、冇圖、相似標籤都唔入
assert.deepEqual(items.map((x) => x.id), ['pinOld', 'new2', 'new3']);
assert.equal(items[0].pin, true);
assert.equal(items[1].title, '十月門診時間更新');
assert.equal(items[1].link, 'https://www.instagram.com/p/new2/');

const withCarousel = selectLatestNews(media, { now, limit: 5 });
assert.ok(withCarousel.some((x) => x.id === 'carousel' && x.img === 'https://cdn.example/c1.jpg'));
assert.ok(!withCarousel.some((x) => ['daily', 'old', 'noimg', 'similar'].includes(x.id)));

assert.deepEqual(selectLatestNews([], { now }), []);

console.log('ig-latest-news tests passed');
