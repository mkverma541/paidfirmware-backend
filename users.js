const { pool } = require("./config/database");
const { faker } = require("@faker-js/faker");

async function generateUsers(count = 3000) {
  const users = [];

  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const username = faker.internet.userName({ firstName, lastName });
    const email = faker.internet.email({ firstName, lastName });
    const password = faker.internet.password();
    const phone = faker.phone.number();
    const country = faker.location.country();
    const city = faker.location.city();
    const state = faker.location.state();
    const address = faker.location.streetAddress();
    const photo = faker.image.avatar();
    const avatar = faker.image.avatar();
    const balance = faker.finance.amount(0, 10000, 2);
    const dialCode = `+${faker.number.int({ min: 1, max: 999 })}`;
    const ip = faker.internet.ip();
    const postal = faker.location.zipCode();
    const latitude = faker.location.latitude();
    const longitude = faker.location.longitude();
    const createdAt = faker.date.past({ years: 2 });
    const updatedAt = faker.date.between({ from: createdAt, to: new Date() });

    users.push([
      username,
      password,
      email,
      firstName,
      lastName,
      phone,
      country,
      city,
      state,
      address,
      photo,
      avatar,
      balance,
      dialCode,
      ip,
      postal,
      latitude,
      longitude,
      createdAt,
      updatedAt,
    ]);
  }

  return users;
}

async function insertUsers() {
  const users = await generateUsers();

  // Generate placeholders dynamically
  const placeholders = users.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");

  const sql = `
    INSERT INTO res_users 
      (username, password, email, first_name, last_name, phone, country, city, state, address, photo, avatar, balance, dial_code, ip, postal, latitude, longitude, created_at, updated_at) 
    VALUES ${placeholders}
  `;

  const values = users.flat(); // Flatten the array to match the placeholders

  try {
    const [result] = await pool.execute(sql, values);
    console.log(`✅ Successfully inserted ${result.affectedRows} users.`);
  } catch (error) {
    console.error("❌ Error inserting users:", error);
  } finally {
    pool.end && pool.end();
  }
}

insertUsers();
