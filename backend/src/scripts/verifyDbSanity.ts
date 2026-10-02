import { prisma } from '../db/prisma';

async function main() {
  console.log('[Sanity Test] Starting VectorMind Database CRUD & Cascade Test...');

  const testEmail = `test_engineer_${Date.now()}@vectormind.internal`;

  // 1. Create User
  console.log('[1/6] Creating test User...');
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      name: 'Test Verification Engineer',
    },
  });
  console.log(`✓ User created: id=${user.id}, email=${user.email}`);

  // 2. Create Document
  console.log('[2/6] Creating Document owned by User...');
  const document = await prisma.document.create({
    data: {
      userId: user.id,
      title: 'Architectural Blueprint v2',
      fileName: 'blueprint.pdf',
      fileSize: 1048576,
      mimeType: 'application/pdf',
      sourceType: 'file',
      status: 'COMPLETED',
      metadata: { author: 'Principal Architect', version: 2 },
    },
  });
  console.log(`✓ Document created: id=${document.id}, title=${document.title}`);

  // 3. Create DocumentChunk with 3072-dimension vector
  console.log('[3/6] Inserting DocumentChunk with 3072-dimension vector...');
  const sampleVector = Array.from({ length: 3072 }, (_, i) => (i % 100) / 1000);
  const vectorStr = `[${sampleVector.join(',')}]`;
  const chunkId = `chunk_${Date.now()}`;

  await prisma.$executeRawUnsafe(
    `INSERT INTO "document_chunks" ("id", "documentId", "chunkIndex", "content", "embedding", "metadata", "pageNumber", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5::vector, $6::jsonb, $7, NOW(), NOW())`,
    chunkId,
    document.id,
    0,
    'This is a verified chunk content for Phase 2 automated test.',
    vectorStr,
    JSON.stringify({ source: 'blueprint.pdf', page: 1, method: 'semantic' }),
    1
  );
  console.log(`✓ DocumentChunk inserted: id=${chunkId}`);

  // 4. Create Conversation
  console.log('[4/6] Creating Conversation for User...');
  const conversation = await prisma.conversation.create({
    data: {
      userId: user.id,
      title: 'Technical Discussion on RAG Architecture',
    },
  });
  console.log(`✓ Conversation created: id=${conversation.id}`);

  // 5. Create Message
  console.log('[5/6] Creating Messages in Conversation...');
  const msgUser = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'USER',
      content: 'Can you verify the database schema and pgvector index?',
    },
  });
  const msgAssistant = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: 'Confirmed. PostgreSQL domain models, relations, cascades, and HNSW indexes are verified.',
    },
  });
  console.log(`✓ Messages created: [${msgUser.role}, ${msgAssistant.role}]`);

  // Verify relational graph
  console.log('[6/6] Verifying deep relational graph query...');
  const userWithGraph = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      documents: {
        include: {
          chunks: true,
        },
      },
      conversations: {
        include: {
          messages: true,
        },
      },
    },
  });

  if (!userWithGraph) throw new Error('Failed to retrieve user relational graph');
  console.log('✓ User graph retrieved successfully:');
  console.log(`  - Documents count: ${userWithGraph.documents.length}`);
  console.log(`  - Chunks in doc: ${userWithGraph.documents[0]?.chunks.length}`);
  console.log(`  - Conversations count: ${userWithGraph.conversations.length}`);
  console.log(`  - Messages in conv: ${userWithGraph.conversations[0]?.messages.length}`);

  // Verify HNSW cosine similarity search query
  console.log('[Bonus] Verifying HNSW vector distance calculation with halfvec...');
  const similarChunks: Array<{ id: string; content: string; distance: number }> =
    await prisma.$queryRawUnsafe(
      `SELECT "id", "content", ("embedding"::halfvec(3072) <=> $1::halfvec(3072)) as distance
       FROM "document_chunks"
       WHERE "documentId" = $2
       ORDER BY distance ASC
       LIMIT 1`,
      vectorStr,
      document.id
    );
  console.log(`✓ Vector search query succeeded! Nearest chunk distance: ${similarChunks[0]?.distance}`);

  // Test Cascade Delete
  console.log('[Cleanup] Testing CASCADE delete by deleting User...');
  await prisma.user.delete({ where: { id: user.id } });

  const remainingDocs = await prisma.document.count({ where: { id: document.id } });
  const remainingChunks = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
    `SELECT COUNT(*) FROM "document_chunks" WHERE "id" = $1`,
    chunkId
  );
  const remainingConvs = await prisma.conversation.count({ where: { id: conversation.id } });
  const remainingMsgs = await prisma.message.count({ where: { conversationId: conversation.id } });

  console.log(`✓ Cascade verified:`);
  console.log(`  - Remaining Documents: ${remainingDocs} (expected: 0)`);
  console.log(`  - Remaining Chunks: ${remainingChunks[0]?.count} (expected: 0)`);
  console.log(`  - Remaining Conversations: ${remainingConvs} (expected: 0)`);
  console.log(`  - Remaining Messages: ${remainingMsgs} (expected: 0)`);

  if (remainingDocs !== 0 || parseInt(remainingChunks[0]?.count || '0', 10) !== 0 || remainingConvs !== 0 || remainingMsgs !== 0) {
    throw new Error('Cascade delete failed to clean up dependent records!');
  }

  console.log('🎉 ALL DATABASE TESTS PASSED SUCCESSFULLY! Database is clean.');
}

main()
  .catch((err) => {
    console.error('❌ SANITY TEST FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
