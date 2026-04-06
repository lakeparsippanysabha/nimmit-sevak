export interface ContactField {
  id: string;
  label: string;
  value: string;
  type: 'email' | 'phone' | 'address' | 'url' | 'date' | 'text';
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  company?: string;
  jobTitle?: string;
  fields: ContactField[];
  notes?: string;
}

const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'Adam', 'Alex', 'Amanda', 'Amber', 'Amy', 'Andrea', 'Angela', 'Anna', 'Anthony', 'Ash', 'Arthur', 'Alice', 'Brian', 'Bella', 'Benjamin', 'Chloe', 'Charles', 'Daniel', 'Diana', 'Edward', 'Eleanor', 'Frank', 'Fiona', 'George', 'Grace', 'Henry', 'Hannah', 'Isaac', 'Isabella', 'Jack', 'Julia', 'Kevin', 'Karen', 'Liam', 'Laura', 'Matthew', 'Megan', 'Nathan', 'Natalie', 'Oliver', 'Olivia', 'Peter', 'Penelope', 'Quinn', 'Rachel', 'Samuel', 'Sarah', 'Thomas', 'Taylor', 'Ulysses', 'Uma', 'Victor', 'Victoria', 'William', 'Wendy', 'Xavier', 'Xena', 'Yusuf', 'Yara', 'Zachary', 'Zoe'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Gomez'];
const companies = ['Acme Corp', 'Globex', 'Soylent', 'Initech', 'Umbrella', 'Massive Dynamic', 'Stark Industries', 'Wayne Enterprises', 'Cyberdyne', 'Oscorp'];

export function generateMockContacts(count: number = 500): Contact[] {
  const contacts: Contact[] = [];
  
  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const company = Math.random() > 0.5 ? companies[Math.floor(Math.random() * companies.length)] : undefined;
    
    const contact: Contact = {
      id: `contact-${i}-${Date.now()}`,
      firstName,
      lastName,
      company,
      jobTitle: company ? 'Executive' : undefined,
      avatarUrl: `https://i.pravatar.cc/150?u=${firstName}${lastName}${i}`,
      fields: [
        {
          id: `f1-${i}`,
          label: 'mobile',
          value: `+1 (555) ${String(Math.floor(Math.random() * 900) + 100)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          type: 'phone'
        },
        {
          id: `f2-${i}`,
          label: 'work',
          value: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company ? company.toLowerCase().replace(' ', '') : 'example'}.com`,
          type: 'email'
        }
      ]
    };
    
    // Add optional home address
    if (Math.random() > 0.7) {
      contact.fields.push({
        id: `f3-${i}`,
        label: 'home',
        value: `${Math.floor(Math.random() * 9000) + 100} Main St, Anytown, CA 90210`,
        type: 'address'
      });
    }

    contacts.push(contact);
  }
  
  return contacts;
}
