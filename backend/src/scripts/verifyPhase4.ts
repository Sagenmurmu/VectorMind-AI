import http from 'http';
import { createApp } from '../app';
import { prisma } from '../db/prisma';

async function main() {
  console.log('--- STARTING PHASE 4 AUTOMATED TEST SUITE ---');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;
  console.log(`[TestServer] Ephemeral server running at ${baseUrl}`);

  const testSuffix = Date.now();
  const userAEmail = `user_a_${testSuffix}@example.com`;
  const userBEmail = `user_b_${testSuffix}@example.com`;
  const password = 'Password123!';

  let tokenA = '';
  let userAId = '';
  let tokenB = '';
  let userBId = '';
  let userADocId = '';
  let conversationId = '';

  try {
    // 1. Register User A
    console.log('\n1. Registering User A...');
    const regARes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userAEmail,
        password,
        name: 'Alice Phase4',
      }),
    });
    const regAData = (await regARes.json()) as any;
    if (!regARes.ok || !regAData.data?.token) {
      throw new Error(`Failed to register User A: ${JSON.stringify(regAData)}`);
    }
    tokenA = regAData.data.token;
    userAId = regAData.data.user.id;
    console.log(`✓ User A registered successfully: ${userAId} (${regAData.data.user.email})`);

    // 2. Login User A
    console.log('\n2. Logging in User A...');
    const loginARes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userAEmail, password }),
    });
    const loginAData = (await loginARes.json()) as any;
    if (!loginARes.ok || !loginAData.data?.token) {
      throw new Error(`Failed to login User A: ${JSON.stringify(loginAData)}`);
    }
    console.log('✓ User A logged in successfully. Received valid JWT.');

    // 3. Verify User A Profile (/auth/me)
    console.log('\n3. Verifying User A /auth/me...');
    const meARes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const meAData = (await meARes.json()) as any;
    if (!meARes.ok || meAData.data?.user?.email !== userAEmail) {
      throw new Error(`Failed to verify User A /me: ${JSON.stringify(meAData)}`);
    }
    console.log(`✓ User A authenticated profile verified: ${meAData.data.user.name}`);

    // 4. Register & Login User B
    console.log('\n4. Registering and logging in User B...');
    const regBRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userBEmail,
        password,
        name: 'Bob Phase4',
      }),
    });
    const regBData = (await regBRes.json()) as any;
    if (!regBRes.ok || !regBData.data?.token) {
      throw new Error(`Failed to register User B: ${JSON.stringify(regBData)}`);
    }
    tokenB = regBData.data.token;
    userBId = regBData.data.user.id;
    console.log(`✓ User B registered successfully: ${userBId} (${regBData.data.user.email})`);

    // 5. User A uploads a private document with sync=true
    console.log('\n5. User A uploading document...');
    const docContent = `CONFIDENTIAL RESEARCH NOTE FOR ALICE:
The experimental VectorMind Phase 4 protocol uses quantum teleportation key QTP-9921 to secure multi-agent communication.
Only authorized agents possessing the secret key QTP-9921 can decode neural transmissions.`;
    
    // Create multipart form body manually
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const docTitle = `Alice Quantum Protocol ${testSuffix}`;
    const fileName = `alice_protocol_${testSuffix}.txt`;

    const bodyParts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\n${docTitle}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="chunkingMethod"\r\n\r\nparagraph\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: text/plain\r\n\r\n${docContent}\r\n`,
      `--${boundary}--\r\n`,
    ];
    const multipartBody = Buffer.from(bodyParts.join(''));

    const uploadRes = await fetch(`${baseUrl}/api/v1/documents/upload?sync=true`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });
    const uploadData = (await uploadRes.json()) as any;
    if (!uploadRes.ok || !uploadData.document?.id) {
      throw new Error(`Failed to upload User A document: ${JSON.stringify(uploadData)}`);
    }
    userADocId = uploadData.document.id;
    console.log(`✓ User A document uploaded and ingested synchronously: ${userADocId}`);
    console.log(`  Total chunks created: ${uploadData.stats?.totalChunks}`);

    // 6. User B lists documents -> MUST NOT see User A's document
    console.log('\n6. Testing Document Isolation: User B listing documents...');
    const listBRes = await fetch(`${baseUrl}/api/v1/documents`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const listBData = (await listBRes.json()) as any;
    const foundInBList = listBData.documents?.some((d: any) => d.id === userADocId);
    if (foundInBList) {
      throw new Error('SECURITY VIOLATION: User B can see User A document in list!');
    }
    console.log(`✓ Document isolation passed: User B sees ${listBData.count} documents (User A's doc not visible).`);

    // 7. User B tries to GET User A's document -> 403 Forbidden
    console.log("\n7. Testing Authorization: User B attempting to GET User A's document...");
    const getBRes = await fetch(`${baseUrl}/api/v1/documents/${userADocId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    if (getBRes.status !== 403) {
      throw new Error(`Expected status 403 Forbidden, but received ${getBRes.status}`);
    }
    console.log('✓ Authorization verified: User B received 403 Forbidden when accessing User A document.');

    // 8. User B tries to DELETE User A's document -> 403 Forbidden
    console.log("\n8. Testing Authorization: User B attempting to DELETE User A's document...");
    const delBRes = await fetch(`${baseUrl}/api/v1/documents/${userADocId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    if (delBRes.status !== 403) {
      throw new Error(`Expected status 403 Forbidden, but received ${delBRes.status}`);
    }
    console.log('✓ Authorization verified: User B received 403 Forbidden when attempting to delete User A document.');

    // 9. User A creates a conversation
    console.log('\n9. User A creating a new conversation...');
    const convRes = await fetch(`${baseUrl}/api/v1/conversations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Quantum Teleportation Chat',
        documentId: userADocId,
      }),
    });
    const convData = (await convRes.json()) as any;
    if (!convRes.ok || !convData.data?.id) {
      throw new Error(`Failed to create conversation: ${JSON.stringify(convData)}`);
    }
    conversationId = convData.data.id;
    console.log(`✓ Conversation created: ${conversationId} (title: "${convData.data.title}")`);

    // 10. User A chats in conversation asking about the secret key
    console.log('\n10. User A executing RAG chat query...');
    const chatRes = await fetch(`${baseUrl}/api/v1/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId,
        documentId: userADocId,
        query: 'What is the secret quantum teleportation key mentioned in the note?',
      }),
    });
    const chatData = (await chatRes.json()) as any;
    if (!chatRes.ok || !chatData.data?.answer) {
      throw new Error(`Chat request failed: ${JSON.stringify(chatData)}`);
    }
    console.log(`✓ RAG Answer received: "${chatData.data.answer.substring(0, 100)}..."`);
    console.log(`✓ Citations returned: ${chatData.data.citations?.length}`);
    if (chatData.data.citations?.length > 0) {
      console.log(`  Citation 1 fileName: ${chatData.data.citations[0].fileName}`);
      console.log(`  Citation 1 similarity: ${chatData.data.citations[0].similarity}`);
    }

    // 11. Verify message persistence and citations in database
    console.log('\n11. Verifying conversation history and citation persistence...');
    const getConvRes = await fetch(`${baseUrl}/api/v1/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const getConvData = (await getConvRes.json()) as any;
    const messages = getConvData.data?.messages || [];
    console.log(`✓ Retrieved conversation. Total messages persisted: ${messages.length}`);
    if (messages.length < 2) {
      throw new Error(`Expected at least 2 messages (user + assistant), found ${messages.length}`);
    }
    const assistantMsg = messages.find((m: any) => m.role?.toUpperCase() === 'ASSISTANT');
    if (!assistantMsg || !Array.isArray(assistantMsg.citations) || assistantMsg.citations.length === 0) {
      throw new Error(`Assistant message citations not persisted properly: ${JSON.stringify(assistantMsg)}`);
    }
    console.log(`✓ Citations successfully persisted in DB: ${assistantMsg.citations.length} citation(s) stored.`);

    // 12. Multi-turn conversation follow-up
    console.log('\n12. Testing multi-turn conversation memory...');
    const followUpRes = await fetch(`${baseUrl}/api/v1/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId,
        query: 'What can authorized agents do with that key?',
      }),
    });
    const followUpData = (await followUpRes.json()) as any;
    if (!followUpRes.ok || !followUpData.data?.answer) {
      throw new Error(`Follow-up chat failed: ${JSON.stringify(followUpData)}`);
    }
    console.log(`✓ Multi-turn follow-up answer: "${followUpData.data.answer.substring(0, 100)}..."`);

    // 13. Test Tenant Isolation for User B in RAG
    console.log("\n13. Testing RAG Vector Isolation: User B querying for Alice's secret key...");
    const chatBRes = await fetch(`${baseUrl}/api/v1/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'What is the secret quantum teleportation key QTP-9921?',
      }),
    });
    const chatBData = (await chatBRes.json()) as any;
    if (!chatBRes.ok) {
      throw new Error(`User B chat failed: ${JSON.stringify(chatBData)}`);
    }
    const bCitations = chatBData.data?.citations || [];
    const leakedDoc = bCitations.some((c: any) => c.documentId === userADocId);
    if (leakedDoc) {
      throw new Error("SECURITY VIOLATION: User B's RAG query retrieved User A's document chunks!");
    }
    console.log(`✓ Vector search isolation verified: User B retrieved 0 chunks from User A's document.`);

    // 14. User A deletes their document
    console.log("\n14. User A deleting their document...");
    const delARes = await fetch(`${baseUrl}/api/v1/documents/${userADocId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const delAData = (await delARes.json()) as any;
    if (!delARes.ok || !delAData.success) {
      throw new Error(`Failed to delete document: ${JSON.stringify(delAData)}`);
    }
    console.log(`✓ User A document deleted successfully.`);

    console.log('\n========================================');
    console.log('✅ ALL PHASE 4 TEST SUITE CHECKS PASSED!');
    console.log('========================================\n');
  } finally {
    // Cleanup users from database
    console.log('[Cleanup] Cleaning up test users and data...');
    try {
      if (conversationId) {
        await prisma.message.deleteMany({ where: { conversationId } }).catch(() => {});
        await prisma.conversation.delete({ where: { id: conversationId } }).catch(() => {});
      }
      if (userADocId) {
        await prisma.$executeRawUnsafe('DELETE FROM "document_chunks" WHERE "documentId" = $1', userADocId).catch(() => {});
        await prisma.document.delete({ where: { id: userADocId } }).catch(() => {});
      }
      if (userAId) {
        await prisma.user.delete({ where: { id: userAId } }).catch(() => {});
      }
      if (userBId) {
        await prisma.user.delete({ where: { id: userBId } }).catch(() => {});
      }
      console.log('[Cleanup] Done.');
    } catch (e) {
      console.warn('[Cleanup] Minor cleanup notice:', e);
    }

    server.close();
  }
}

main().catch((err) => {
  console.error('\n❌ PHASE 4 VERIFICATION FAILED:', err);
  process.exit(1);
});
