/**
 * In-Memory Data Store
 * CRUD operations driven by DB schema configuration
 * Simulates a real database for the runtime renderer
 */

class DataStore {
  constructor() {
    this.tables = {};
    this.schema = {};
    this.idCounters = {};
  }

  /**
   * Initialize tables from DB schema config
   */
  initialize(dbConfig) {
    this.tables = {};
    this.schema = {};
    this.idCounters = {};

    if (!dbConfig?.tables) return;

    for (const table of dbConfig.tables) {
      this.tables[table.name] = [];
      this.schema[table.name] = table;
      this.idCounters[table.name] = 1;
    }

    // Seed with sample data
    this.seedSampleData(dbConfig);
  }

  /**
   * Generate sample data for each table
   */
  seedSampleData(dbConfig) {
    for (const table of dbConfig.tables) {
      const sampleCount = table.name.toLowerCase().includes('user') ? 3 : 5;
      for (let i = 0; i < sampleCount; i++) {
        const record = this.generateSampleRecord(table, i);
        this.tables[table.name].push(record);
        this.idCounters[table.name]++;
      }
    }
  }

  generateSampleRecord(table, index) {
    const record = {};
    const sampleNames = ['Alice Johnson', 'Bob Smith', 'Carol White', 'David Brown', 'Eve Davis', 'Frank Miller', 'Grace Lee'];
    const sampleEmails = ['alice@demo.com', 'bob@demo.com', 'carol@demo.com', 'david@demo.com', 'eve@demo.com'];
    const sampleTitles = ['Project Alpha', 'Sprint Review', 'Q4 Report', 'Design System', 'API Integration', 'Dashboard Update'];
    const sampleDescriptions = ['Important task that needs attention', 'Follow up required', 'In progress', 'Completed successfully', 'Pending review'];

    for (const col of table.columns) {
      switch (col.name) {
        case 'id':
          record.id = String(index + 1);
          break;
        case 'email':
          record.email = sampleEmails[index % sampleEmails.length];
          break;
        case 'password':
          record.password = '••••••••';
          break;
        case 'role':
          record.role = index === 0 ? 'admin' : 'user';
          break;
        case 'name':
        case 'full_name':
        case 'fullName':
        case 'username':
          record[col.name] = sampleNames[index % sampleNames.length];
          break;
        case 'title':
          record[col.name] = sampleTitles[index % sampleTitles.length];
          break;
        case 'description':
        case 'notes':
        case 'content':
          record[col.name] = sampleDescriptions[index % sampleDescriptions.length];
          break;
        case 'createdAt':
        case 'created_at':
          record[col.name] = new Date(Date.now() - index * 86400000).toISOString().split('T')[0];
          break;
        case 'updatedAt':
        case 'updated_at':
          record[col.name] = new Date().toISOString().split('T')[0];
          break;
        case 'status':
          record[col.name] = col.enumValues?.[index % (col.enumValues?.length || 1)] || 'active';
          break;
        case 'phone':
          record[col.name] = `+1-555-${String(1000 + index).slice(1)}-${String(1000 + index * 3).slice(1)}`;
          break;
        default:
          record[col.name] = this.generateFieldValue(col, index);
      }
    }

    return record;
  }

  generateFieldValue(col, index) {
    switch (col.type) {
      case 'string':
        return `${col.name}_${index + 1}`;
      case 'number':
        return Math.floor(Math.random() * 100) + 1;
      case 'currency':
        return (Math.random() * 1000 + 10).toFixed(2);
      case 'boolean':
        return index % 2 === 0;
      case 'date':
        return new Date(Date.now() - index * 86400000).toISOString().split('T')[0];
      case 'email':
        return `user${index + 1}@example.com`;
      case 'text':
        return `Sample ${col.name} text content ${index + 1}`;
      case 'enum':
        return col.enumValues?.[index % (col.enumValues?.length || 1)] || 'default';
      case 'id':
        return String(index + 1);
      case 'url':
        return `https://example.com/${col.name}/${index + 1}`;
      case 'password':
        return '••••••••';
      default:
        return `${col.name}_${index + 1}`;
    }
  }

  // CRUD Operations
  list(tableName, filters = {}) {
    const data = this.tables[tableName] || [];
    if (Object.keys(filters).length === 0) return [...data];

    return data.filter(row => {
      return Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        return String(row[key]).toLowerCase().includes(String(value).toLowerCase());
      });
    });
  }

  get(tableName, id) {
    const data = this.tables[tableName] || [];
    return data.find(row => String(row.id) === String(id)) || null;
  }

  create(tableName, record) {
    if (!this.tables[tableName]) {
      this.tables[tableName] = [];
      this.idCounters[tableName] = 1;
    }

    const newRecord = {
      ...record,
      id: String(this.idCounters[tableName]++),
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    this.tables[tableName].push(newRecord);
    return newRecord;
  }

  update(tableName, id, updates) {
    const data = this.tables[tableName] || [];
    const index = data.findIndex(row => String(row.id) === String(id));
    if (index === -1) return null;

    data[index] = {
      ...data[index],
      ...updates,
      id: data[index].id,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    return data[index];
  }

  delete(tableName, id) {
    const data = this.tables[tableName] || [];
    const index = data.findIndex(row => String(row.id) === String(id));
    if (index === -1) return false;

    data.splice(index, 1);
    return true;
  }

  // Analytics helpers
  count(tableName) {
    return (this.tables[tableName] || []).length;
  }

  getStats() {
    const stats = {};
    for (const [name, data] of Object.entries(this.tables)) {
      stats[name] = {
        count: data.length,
        label: name.charAt(0).toUpperCase() + name.slice(1),
      };
    }
    return stats;
  }
}

// Singleton
export const dataStore = new DataStore();
