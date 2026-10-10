// Offline, no-charge contract tests for ReconFeed AI Studio request bodies and readiness.
import assert from 'node:assert/strict';
import generate from '../api/generate.js';
import health from '../api/health.js';

const jobId = '123e4567-e89b-42d3-a456-426614174000';
let upstreamInput;
let upstreamModel;
let reservations = 0;

process.env.REPLICATE_API_TOKEN = 'fake-test-token-not-a-real-secret';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-test-role-not-a-real-secret';
globalThis.fetch = async (url, options = {}) => {
  const uri = String(url);
  if (uri.endsWith('/auth/v1/user')) return Response.json({ id: 'test-user-id' });
  if (uri.includes('/rest/v1/rpc/reserve_ai_generation')) {
    reservations++;
    return Response.json(jobId);
  }
  if (uri.includes('/rest/v1/rpc/finalize_ai_generation')) return Response.json(true);
  if (uri.includes('api.replicate.com/v1/models/')) {
    upstreamInput = JSON.parse(options.body).input;
    upstreamModel = uri;
    return Response.json({ id: 'mock-provider-prediction', status: 'starting', output: null });
  }
  if (uri.includes('/rest/v1/profiles?select=id')) return Response.json([]);
  throw new Error('Unexpected network operation in offline AI test: ' + uri);
};

function mockResponse() {
  return {
    code: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.code = code; return this; },
    json(data) { this.body = data; return this; }
  };
}

async function request(workflow, aspectRatio = '9:16', model = '') {
  if (model) process.env.REPLICATE_VIDEO_MODEL = model;
  else delete process.env.REPLICATE_VIDEO_MODEL;
  upstreamInput = null;
  upstreamModel = null;
  const res = mockResponse();
  await generate({
    method: 'POST',
    headers: { authorization: 'Bearer offline-unit-test' },
    body: { workflow, aspectRatio, duration: 5, prompt: 'A friendly animated avatar waves at the camera.' }
  }, res);
  return res;
}

const portrait = await request('text-video', '9:16');
assert.equal(portrait.code, 202);
assert.match(upstreamModel, /wan-video\/wan-2\.6-t2v\/predictions$/);
assert.equal(upstreamInput.size, '720*1280');
assert.equal(upstreamInput.duration, 5);
assert.equal(upstreamInput.aspect_ratio, undefined);
assert.equal(upstreamInput.image, undefined);

const square = await request('text-video', '1:1');
assert.equal(square.code, 202);
assert.equal(upstreamInput.size, '960*960');

const landscape = await request('text-video', '16:9');
assert.equal(landscape.code, 202);
assert.equal(upstreamInput.size, '1280*720');

const image = await request('image', '9:16');
assert.equal(image.code, 202);
assert.match(upstreamModel, /black-forest-labs\/flux-schnell\/predictions$/);
assert.equal(upstreamInput.aspect_ratio, '9:16');
assert.equal(upstreamInput.size, undefined);

const before = reservations;
const runwayWithoutImage = await request('text-video', '9:16', 'runwayml/gen4-turbo');
assert.equal(runwayWithoutImage.code, 400);
assert.equal(reservations, before, 'Reject incompatible video model before consuming a quota reservation');

delete process.env.SUPABASE_SERVICE_ROLE_KEY;
let status = mockResponse();
await health({ method: 'GET' }, status);
assert.equal(status.code, 200);
assert.equal(status.body.checks.aiConfigured, false);
assert.deepEqual(status.body.checks.aiMissingConfiguration, ['SUPABASE_SERVICE_ROLE_KEY']);

process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-test-role-not-a-real-secret';
status = mockResponse();
await health({ method: 'GET' }, status);
assert.equal(status.body.checks.aiConfigured, true);
assert.deepEqual(status.body.checks.aiMissingConfiguration, []);

console.log('ReconFeed AI Studio offline contract checks passed (video inputs, image inputs, quotas, server readiness).');
