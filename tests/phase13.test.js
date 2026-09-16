'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Content, ContentCategory, AuditLog } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0791${suffix}`;

let clientToken;
let adminToken;
let categoryId;
let articleId;
let articleSlug;

afterAll(async () => {
  await Content.destroy({ where: { slug: [articleSlug, `habari-za-afya-${suffix}`].filter(Boolean) } });
  await ContentCategory.destroy({ where: { slug: `afya-ya-mama-${suffix}` } });
  await User.destroy({ where: { phone: clientPhone } });
  await sequelize.close();
});

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Content Test Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  clientToken = register.body.data.tokens.accessToken;

  const adminLogin = await request(app).post('/api/auth/login').send({
    identifier: '0700000003',
    password: 'Password123!',
  });
  adminToken = adminLogin.body.data.tokens.accessToken;
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('Phase 13 — Categories', () => {
  it('lets an admin create a category and everyone read them', async () => {
    const res = await request(app)
      .post('/api/content/categories')
      .set(auth(adminToken))
      .send({ name: `Afya ya Mama ${suffix}`, slug: `afya-ya-mama-${suffix}` });

    expect(res.status).toBe(201);
    categoryId = res.body.data.category.id;

    const list = await request(app).get('/api/content/categories').set(auth(clientToken));
    expect(list.status).toBe(200);
    expect(list.body.data.categories.some((c) => c.id === categoryId)).toBe(true);
  });

  it('blocks a client from creating one', async () => {
    const res = await request(app)
      .post('/api/content/categories')
      .set(auth(clientToken))
      .send({ name: 'Haramu' });
    expect(res.status).toBe(403);
  });
});

describe('Phase 13 — Drafts stay private until published', () => {
  it('creates content as a draft whatever the caller asks for', async () => {
    const res = await request(app)
      .post('/api/content')
      .set(auth(adminToken))
      .send({
        type: 'ARTICLE',
        title: `Umuhimu wa chanjo kwa watoto ${suffix}`,
        body: 'Chanjo humkinga mtoto dhidi ya magonjwa hatari. Ratiba hupatikana kliniki.',
        tags: ['chanjo', 'watoto'],
        categoryId,
        // Ignored on purpose: publishing is its own deliberate act.
        status: 'PUBLISHED',
      });

    expect(res.status).toBe(201);
    articleId = res.body.data.item.id;
    articleSlug = res.body.data.item.slug;

    expect(res.body.data.item.status).toBe('DRAFT');
    expect(res.body.data.item.publishedAt).toBeNull();
    expect(articleSlug).toMatch(/^umuhimu-wa-chanjo-kwa-watoto/);
  });

  it('hides a draft from clients entirely, including by slug', async () => {
    const list = await request(app).get('/api/content').set(auth(clientToken));
    expect(list.body.data.items.some((i) => i.id === articleId)).toBe(false);

    // Absent rather than forbidden, so an unpublished title cannot be
    // found by guessing slugs.
    const direct = await request(app).get(`/api/content/${articleSlug}`).set(auth(clientToken));
    expect(direct.status).toBe(404);
  });

  it('shows the draft to an admin who asks for it', async () => {
    const list = await request(app)
      .get('/api/content?includeDrafts=true')
      .set(auth(adminToken));
    expect(list.body.data.items.some((i) => i.id === articleId)).toBe(true);

    const direct = await request(app).get(`/api/content/${articleSlug}`).set(auth(adminToken));
    expect(direct.status).toBe(200);
  });

  it('blocks a client from writing or publishing', async () => {
    const create = await request(app)
      .post('/api/content')
      .set(auth(clientToken))
      .send({ title: 'Haramu kabisa', body: 'x' });
    expect(create.status).toBe(403);

    const publish = await request(app)
      .post(`/api/content/${articleId}/publish`)
      .set(auth(clientToken));
    expect(publish.status).toBe(403);
  });
});

describe('Phase 13 — Publishing', () => {
  it('refuses to publish an article with no body', async () => {
    const empty = await request(app)
      .post('/api/content')
      .set(auth(adminToken))
      .send({ type: 'ARTICLE', title: `Kichwa pekee ${suffix}` });

    const res = await request(app)
      .post(`/api/content/${empty.body.data.item.id}/publish`)
      .set(auth(adminToken));
    expect(res.status).toBe(400);

    await Content.destroy({ where: { id: empty.body.data.item.id } });
  });

  it('refuses to publish a podcast with no audio', async () => {
    const created = await request(app)
      .post('/api/content')
      .set(auth(adminToken))
      .send({ type: 'PODCAST', title: `Podikasti bila sauti ${suffix}` });

    const res = await request(app)
      .post(`/api/content/${created.body.data.item.id}/publish`)
      .set(auth(adminToken));
    expect(res.status).toBe(400);

    await Content.destroy({ where: { id: created.body.data.item.id } });
  });

  it('publishes, records who did it, and makes it readable', async () => {
    const res = await request(app).post(`/api/content/${articleId}/publish`).set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.item.status).toBe('PUBLISHED');
    expect(res.body.data.item.publishedAt).not.toBeNull();

    // Worth knowing later if something in it turns out to be wrong.
    const audit = await AuditLog.findOne({
      where: { action: 'CONTENT_PUBLISHED', entityId: articleId },
    });
    expect(audit).not.toBeNull();

    const read = await request(app).get(`/api/content/${articleSlug}`).set(auth(clientToken));
    expect(read.status).toBe(200);
    expect(read.body.data.item.category.id).toBe(categoryId);
    expect(read.body.data.item.author.name).toBeTruthy();
  });

  it('keeps the slug when a published title is corrected, so shared links survive', async () => {
    const res = await request(app)
      .patch(`/api/content/${articleId}`)
      .set(auth(adminToken))
      .send({ title: `Umuhimu wa chanjo kwa watoto wadogo ${suffix}` });

    expect(res.status).toBe(200);
    expect(res.body.data.item.slug).toBe(articleSlug);
  });

  it('will not let an ordinary edit change the status', async () => {
    const res = await request(app)
      .patch(`/api/content/${articleId}`)
      .set(auth(adminToken))
      .send({ status: 'DRAFT' });

    expect(res.status).toBe(200);
    expect(res.body.data.item.status).toBe('PUBLISHED');
  });

  it('unpublishes back to a draft', async () => {
    const res = await request(app).post(`/api/content/${articleId}/unpublish`).set(auth(adminToken));
    expect(res.body.data.item.status).toBe('DRAFT');

    const gone = await request(app).get(`/api/content/${articleSlug}`).set(auth(clientToken));
    expect(gone.status).toBe(404);

    await request(app).post(`/api/content/${articleId}/publish`).set(auth(adminToken));
  });
});

describe('Phase 13 — Finding things', () => {
  it('filters by type, tag and category, and searches the text', async () => {
    const news = await request(app)
      .post('/api/content')
      .set(auth(adminToken))
      .send({
        type: 'NEWS',
        title: `Habari za afya ${suffix}`,
        slug: `habari-za-afya-${suffix}`,
        sourceUrl: 'https://example.org/habari',
        body: 'Wizara imetangaza kampeni mpya ya chanjo.',
        tags: ['habari'],
      });
    await request(app).post(`/api/content/${news.body.data.item.id}/publish`).set(auth(adminToken));

    const byType = await request(app).get('/api/content?type=NEWS').set(auth(clientToken));
    expect(byType.body.data.items.every((i) => i.type === 'NEWS')).toBe(true);

    const byTag = await request(app).get('/api/content?tag=chanjo').set(auth(clientToken));
    expect(byTag.body.data.items.some((i) => i.id === articleId)).toBe(true);

    const byCategory = await request(app)
      .get(`/api/content?categoryId=${categoryId}`)
      .set(auth(clientToken));
    expect(byCategory.body.data.items.every((i) => i.categoryId === categoryId)).toBe(true);

    const search = await request(app)
      .get(`/api/content?q=${encodeURIComponent('kampeni mpya')}`)
      .set(auth(clientToken));
    expect(search.body.data.items.some((i) => i.slug === `habari-za-afya-${suffix}`)).toBe(true);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/content');
    expect(res.status).toBe(401);
  });
});
