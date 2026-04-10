export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  gender?: string;
  age?: number;
  email?: string;
  cellphone?: string;
  memberType?: string;
  address1?: string;
  address2?: string;
  city?: string;
  county?: string;
  state?: string;
  zip?: string;
  country?: string;
  followup?: string;
  mandal?: string;
  avatarUrl?: string;
  notes?: string;
}

const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'Adam', 'Alex', 'Amanda', 'Amber', 'Amy', 'Andrea', 'Angela', 'Anna', 'Anthony', 'Ash', 'Arthur', 'Alice', 'Brian', 'Bella', 'Benjamin', 'Chloe', 'Charles', 'Daniel', 'Diana', 'Edward', 'Eleanor', 'Frank', 'Fiona', 'George', 'Grace', 'Henry', 'Hannah', 'Isaac', 'Isabella', 'Jack', 'Julia', 'Kevin', 'Karen', 'Liam', 'Laura', 'Matthew', 'Megan', 'Nathan', 'Natalie', 'Oliver', 'Olivia', 'Peter', 'Penelope', 'Quinn', 'Rachel', 'Samuel', 'Sarah', 'Thomas', 'Taylor', 'Ulysses', 'Uma', 'Victor', 'Victoria', 'William', 'Wendy', 'Xavier', 'Xena', 'Yusuf', 'Yara', 'Zachary', 'Zoe'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Gomez'];

export function generateMockContacts(count: number = 20): Contact[] {
  const contacts: Contact[] = [];
  
  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    const contact: Contact = {
      id: `contact-${i}-${Date.now()}`,
      firstName,
      lastName,
      nickname: firstName.substring(0, 3),
      gender: Math.random() > 0.5 ? 'Male' : 'Female',
      age: Math.floor(Math.random() * 60) + 18,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      cellphone: `+1 (555) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      memberType: Math.random() > 0.8 ? 'Admin' : 'User',
      address1: `${Math.floor(Math.random() * 9000) + 100} Main St`,
      city: 'Parsippany',
      state: 'NJ',
      zip: '07054',
      country: 'USA',
      mandal: Math.random() > 0.5 ? 'Lake Parsippany' : 'Troy Hills',
      avatarUrl: `https://i.pravatar.cc/150?u=${firstName}${lastName}${i}`,
      notes: 'Sample contact created via generator.'
    };
    
    contacts.push(contact);
  }
  
  return contacts;
}
