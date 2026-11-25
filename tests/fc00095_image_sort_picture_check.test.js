// FC-00095: images are sorted by a picture check first (no API needed); only unclear ones go to Gemini,
// and an unclear answer is Unsure, never a guessed Timecard.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./fc70-helpers');

// RGBA buffer: `n` pixels; `palette` colours repeated (a screenshot-like image) or all distinct (photo-like).
function rgba(n, colourOf) {
  const d = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) { const [r, g, b] = colourOf(i); d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
  return d;
}

test('test_screenshot_like_image_is_easyclocking', () => {
  const api = setup();
  const pal = [[230, 230, 230], [255, 255, 255], [40, 40, 40], [200, 200, 200]];
  const d = rgba(10000, i => (i % 50 === 0 ? [i % 256, (i * 7) % 256, (i * 13) % 256] : pal[i % 4]));
  const share = api.imageColourShare(d);
  assert.ok(share > 0.9, String(share));
  assert.equal(api.imageKindFromShare(share), 'EC');
});

test('test_photo_like_image_is_timecard', () => {
  const api = setup();
  const d = rgba(10000, i => [(i * 37) % 256, (i * 91) % 256, (i * 53 + (i >> 8)) % 256]);
  const share = api.imageColourShare(d);
  assert.ok(share < 0.1, String(share));
  assert.equal(api.imageKindFromShare(share), 'TC');
});

test('test_in_between_is_left_to_gemini_or_the_owner', () => {
  const api = setup();
  assert.equal(api.imageKindFromShare(0.45), null);
  assert.equal(api.imageKindFromShare(null), null);
  assert.equal(api.imageKindFromShare(api.IMG_SORT_EC_MIN), 'EC');
  assert.equal(api.imageKindFromShare(api.IMG_SORT_TC_MAX), 'TC');
  assert.equal(api.imageColourShare(new Uint8ClampedArray(8)), null, 'fully transparent image: no answer');
});

test('test_without_a_key_an_unclear_image_is_unsure_not_timecard', async () => {
  const api = setup();
  // The Node sandbox cannot decode images, so the picture check has no answer here.
  const k = await api.classifyTimecardImage({ name: 'x.png', type: 'image/png' }, '');
  assert.equal(k, 'UNSURE');
});

test('test_gemini_unclear_answer_is_unsure_and_current_model_is_used', async () => {
  const api = setup();
  const urls = [];
  api.__sandbox.fetch = async (url) => { urls.push(url); return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'I am not sure' }] } }] }) }; };
  const k = await api.classifyTimecardImage({ name: 'x.png', type: 'image/png', size: 10, arrayBuffer: async () => new ArrayBuffer(4) }, 'KEY');
  assert.equal(k, 'UNSURE');
  assert.ok(urls.length === 1 && /gemini-2\.5-flash-lite/.test(urls[0]), urls[0]);
  api.__sandbox.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'EC' }] } }] }) });
  assert.equal(await api.classifyTimecardImage({ name: 'x.png', type: 'image/png', size: 10, arrayBuffer: async () => new ArrayBuffer(4) }, 'KEY'), 'EC');
});
