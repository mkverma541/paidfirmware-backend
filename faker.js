const { faker } = require('@faker-js/faker');
const axios = require('axios');

const API_URL = 'http://localhost:3000/api/team'; // Change to your actual API endpoint

// Function to generate a fake team member
const generateFakeTeamMember = () => {
    return {
        name: faker.person.fullName(),
        designation: faker.person.jobTitle(),
        email: faker.internet.email(),
        photo: faker.image.avatar(),
        phone: faker.phone.number('+1##########'),
        gender: faker.helpers.arrayElement(['Male', 'Female', 'Other']),
        bio: faker.lorem.paragraph(),
        address: faker.location.streetAddress(),
        country: faker.location.country(),
        social_links: [
            { platform: 'LinkedIn', url: faker.internet.url() },
            { platform: 'Twitter', url: faker.internet.url() }
        ],
        status: faker.datatype.boolean(),
    };
};

// Function to insert fake team members by calling the API
const insertFakeTeamMembers = async (count = 10) => {
    for (let i = 0; i < count; i++) {
        const teamMember = generateFakeTeamMember();
        try {
            const response = await axios.post(API_URL, teamMember);
            console.log(`✅ Team Member ${i + 1} Created:`, response.data);
        } catch (error) {
            console.error(`❌ Error Creating Team Member ${i + 1}:`, error.response?.data || error.message);
        }
    }
};

// Run the function to insert fake data
insertFakeTeamMembers(5); // Change the number to insert more team members
