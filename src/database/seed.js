const { getDb } = require('./connection');
const { initializeDatabase } = require('./schema');
const { generateUUID, getCurrentTimestamp } = require('../utils/helpers');
const { ROLES } = require('../utils/constants');
const bcrypt = require('bcryptjs');

/**
 * Seeds the database with initial sample data.
 */
async function seed() {
  console.log('Initializing database...');
  initializeDatabase();
  
  const db = getDb();
  const now = getCurrentTimestamp();

  console.log('Seeding data...');

  // 1. Check and Seed Users
  let adminId, librarianId, memberId;
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@library.com');
  
  if (!adminExists) {
    adminId = generateUUID();
    librarianId = generateUUID();
    memberId = generateUUID();
    
    const adminHash = await bcrypt.hash('admin123', 10);
    const libHash = await bcrypt.hash('lib123', 10);
    const memberHash = await bcrypt.hash('member123', 10);

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, username, password_hash, full_name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(adminId, 'admin@library.com', 'admin', adminHash, 'System Administrator', ROLES.ADMIN, now, now);
    insertUser.run(librarianId, 'librarian@library.com', 'librarian', libHash, 'Jane Librarian', ROLES.LIBRARIAN, now, now);
    insertUser.run(memberId, 'member@library.com', 'member', memberHash, 'John Reader', ROLES.MEMBER, now, now);
    console.log('Users seeded.');
  } else {
    adminId = adminExists.id;
    memberId = db.prepare('SELECT id FROM users WHERE email = ?').get('member@library.com').id;
    console.log('Users already exist, skipping user seed.');
  }

  // 2. Check and Seed Categories
  let fictionId, nonFictionId, bioId, sciFiId, historyId;
  const catExists = db.prepare('SELECT id FROM categories WHERE name = ?').get('Fiction');
  
  if (!catExists) {
    fictionId = generateUUID();
    nonFictionId = generateUUID();
    bioId = generateUUID();
    const selfHelpId = generateUUID();
    
    sciFiId = generateUUID();
    const fantasyId = generateUUID();
    const litFicId = generateUUID();
    historyId = generateUUID();
    const scienceId = generateUUID();

    const insertCat = db.prepare('INSERT INTO categories (id, name, parent_category_id, created_at) VALUES (?, ?, ?, ?)');
    
    // Parents
    insertCat.run(fictionId, 'Fiction', null, now);
    insertCat.run(nonFictionId, 'Non-Fiction', null, now);
    insertCat.run(bioId, 'Biography', null, now);
    insertCat.run(selfHelpId, 'Self-Help', null, now);
    
    // Children
    insertCat.run(sciFiId, 'Science Fiction', fictionId, now);
    insertCat.run(fantasyId, 'Fantasy', fictionId, now);
    insertCat.run(litFicId, 'Literary Fiction', fictionId, now);
    insertCat.run(historyId, 'History', nonFictionId, now);
    insertCat.run(scienceId, 'Science', nonFictionId, now);
    console.log('Categories seeded.');
  } else {
    fictionId = catExists.id;
    sciFiId = db.prepare('SELECT id FROM categories WHERE name = ?').get('Science Fiction')?.id;
    historyId = db.prepare('SELECT id FROM categories WHERE name = ?').get('History')?.id;
    console.log('Categories already exist, skipping category seed.');
  }

  // 3. Check and Seed Authors
  let orwellId, rowlingId, murakamiId, adichieId, harariId, huxleyId;
  const authorExists = db.prepare('SELECT id FROM authors WHERE name = ?').get('George Orwell');
  
  if (!authorExists) {
    orwellId = generateUUID();
    rowlingId = generateUUID();
    murakamiId = generateUUID();
    adichieId = generateUUID();
    harariId = generateUUID();
    huxleyId = generateUUID();

    const insertAuthor = db.prepare('INSERT INTO authors (id, name, nationality, birth_date, created_at) VALUES (?, ?, ?, ?, ?)');
    
    insertAuthor.run(orwellId, 'George Orwell', 'British', '1903-06-25', now);
    insertAuthor.run(rowlingId, 'J.K. Rowling', 'British', '1965-07-31', now);
    insertAuthor.run(murakamiId, 'Haruki Murakami', 'Japanese', '1949-01-12', now);
    insertAuthor.run(adichieId, 'Chimamanda Ngozi Adichie', 'Nigerian', '1977-09-15', now);
    insertAuthor.run(harariId, 'Yuval Noah Harari', 'Israeli', '1976-02-24', now);
    insertAuthor.run(huxleyId, 'Aldous Huxley', 'British', '1894-07-26', now);
    console.log('Authors seeded.');
  } else {
    orwellId = authorExists.id;
    murakamiId = db.prepare('SELECT id FROM authors WHERE name = ?').get('Haruki Murakami')?.id;
    harariId = db.prepare('SELECT id FROM authors WHERE name = ?').get('Yuval Noah Harari')?.id;
    console.log('Authors already exist, skipping author seed.');
  }

  // 4. Check and Seed Books
  const bookExists = db.prepare('SELECT id FROM books WHERE title = ?').get('1984');
  
  if (!bookExists && orwellId && fictionId) {
    const booksData = [
      { id: generateUUID(), isbn: '9780451524935', title: '1984', desc: 'A dystopian social science fiction novel and cautionary tale.', author_id: orwellId, cat_id: sciFiId, year: 1949, pages: 328 },
      { id: generateUUID(), isbn: '9780451526342', title: 'Animal Farm', desc: 'A beast fable, in form of satirical allegorical novella.', author_id: orwellId, cat_id: fictionId, year: 1945, pages: 112 },
      { id: generateUUID(), isbn: '9780375713278', title: 'Norwegian Wood', desc: 'A nostalgic story of loss and burgeoning sexuality.', author_id: murakamiId, cat_id: fictionId, year: 1987, pages: 296 },
      { id: generateUUID(), isbn: '9781400079278', title: 'Kafka on the Shore', desc: 'Two distinct, interrelated plots.', author_id: murakamiId, cat_id: fictionId, year: 2002, pages: 505 },
      { id: generateUUID(), isbn: '9780062316097', title: 'Sapiens', desc: 'A brief history of humankind.', author_id: harariId, cat_id: historyId, year: 2011, pages: 443 },
      { id: generateUUID(), isbn: '9780062464316', title: 'Homo Deus', desc: 'A brief history of tomorrow.', author_id: harariId, cat_id: historyId, year: 2015, pages: 428 }
    ];

    const insertBook = db.prepare(`
      INSERT INTO books (id, isbn, title, description, author_id, category_id, publication_year, publisher, page_count, total_copies, available_copies, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Sample Publisher', ?, 3, 3, ?, ?)
    `);

    for (const b of booksData) {
      if (b.author_id && b.cat_id) {
        insertBook.run(b.id, b.isbn, b.title, b.desc, b.author_id, b.cat_id, b.year, b.pages, now, now);
      }
    }
    console.log('Books seeded.');
  }

  console.log('Database seeded successfully!');
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
