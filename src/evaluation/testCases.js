/**
 * Test cases for evaluation framework
 * 10 real product prompts + 10 edge cases
 */

export const realProductPrompts = [
  {
    id: 'real-01',
    name: 'CRM System',
    prompt: 'Build a CRM with login, contacts management, dashboard with analytics, role-based access control with admin and user roles, and a premium plan with payment tracking. Admins can see analytics and manage all contacts.',
    expectedEntities: ['users', 'contacts', 'payments'],
    expectedPages: ['dashboard', 'contacts', 'login'],
    complexity: 'medium',
  },
  {
    id: 'real-02',
    name: 'Project Management',
    prompt: 'Create a project management tool with Kanban boards, team member assignments, deadline tracking, task priorities (high/medium/low), and project dashboards. Team leads can create projects, members can update tasks.',
    expectedEntities: ['users', 'projects', 'tasks'],
    expectedPages: ['dashboard', 'projects', 'tasks'],
    complexity: 'medium',
  },
  {
    id: 'real-03',
    name: 'E-Commerce Store',
    prompt: 'Build an e-commerce store with product catalog, shopping cart, checkout process, order tracking, and customer reviews. Admin can manage products and view sales analytics. Customers can browse, purchase, and track orders.',
    expectedEntities: ['products', 'orders', 'users'],
    expectedPages: ['products', 'orders', 'dashboard'],
    complexity: 'high',
  },
  {
    id: 'real-04',
    name: 'Blog Platform',
    prompt: 'Create a blog platform where authors can write posts with rich text, add categories and tags, and manage comments. Readers can browse posts, leave comments, and subscribe to newsletters. Admin panel for content moderation.',
    expectedEntities: ['posts', 'comments', 'users'],
    expectedPages: ['posts', 'dashboard', 'login'],
    complexity: 'medium',
  },
  {
    id: 'real-05',
    name: 'Restaurant Reservation',
    prompt: 'Build a restaurant reservation system with table management, menu display with prices, customer reviews and ratings, and booking calendar. Restaurant staff can manage reservations and menu. Customers can view menu and book tables.',
    expectedEntities: ['reservations', 'tables', 'menu_items'],
    expectedPages: ['reservations', 'menu', 'dashboard'],
    complexity: 'medium',
  },
  {
    id: 'real-06',
    name: 'Fitness Tracker',
    prompt: 'Create a fitness tracking app with workout logging, exercise library, progress charts showing weight and reps over time, and goal setting. Users can log daily workouts, track calories, and see weekly/monthly progress.',
    expectedEntities: ['workouts', 'exercises', 'goals'],
    expectedPages: ['dashboard', 'workouts', 'progress'],
    complexity: 'medium',
  },
  {
    id: 'real-07',
    name: 'Inventory Management',
    prompt: 'Build an inventory management system with stock tracking, supplier management, purchase orders, low-stock alerts, and warehouse location tracking. Warehouse managers can update stock, purchasers can create POs.',
    expectedEntities: ['products', 'suppliers', 'purchase_orders'],
    expectedPages: ['inventory', 'suppliers', 'dashboard'],
    complexity: 'high',
  },
  {
    id: 'real-08',
    name: 'Event Management',
    prompt: 'Create an event management platform with event creation, ticketing, attendee registration, event schedule management, and venue booking. Organizers create events, attendees register and purchase tickets.',
    expectedEntities: ['events', 'tickets', 'attendees'],
    expectedPages: ['events', 'tickets', 'dashboard'],
    complexity: 'high',
  },
  {
    id: 'real-09',
    name: 'Learning Management',
    prompt: 'Build a learning management system with course creation, lesson management, quiz system with multiple choice questions, student progress tracking, and certificates. Instructors create courses, students enroll and take quizzes.',
    expectedEntities: ['courses', 'lessons', 'quizzes'],
    expectedPages: ['courses', 'dashboard', 'quizzes'],
    complexity: 'high',
  },
  {
    id: 'real-10',
    name: 'HR Portal',
    prompt: 'Create an HR portal with employee profiles, leave management with approval workflow, attendance tracking, department management, and payroll summary. HR managers approve leaves, employees can apply for leave and view payslips.',
    expectedEntities: ['employees', 'leaves', 'departments'],
    expectedPages: ['employees', 'leaves', 'dashboard'],
    complexity: 'high',
  },
];

export const edgeCasePrompts = [
  {
    id: 'edge-01',
    name: 'Vague Input',
    prompt: 'Make me an app',
    expectedBehavior: 'Should make assumptions and document them',
    type: 'vague',
  },
  {
    id: 'edge-02',
    name: 'Conflicting Requirements',
    prompt: 'Build a free app with paid premium features. No login required but users should have personal profiles and saved preferences.',
    expectedBehavior: 'Should resolve conflict or document assumptions',
    type: 'conflicting',
  },
  {
    id: 'edge-03',
    name: 'Single Word',
    prompt: 'Dashboard',
    expectedBehavior: 'Should expand into a basic dashboard app with assumptions',
    type: 'incomplete',
  },
  {
    id: 'edge-04',
    name: 'Overly Complex',
    prompt: 'Build a complete enterprise platform with user management, role-based access, multi-tenant support, real-time notifications, chat system, file upload, video conferencing, project management, time tracking, invoicing, CRM, helpdesk, knowledge base, API gateway, analytics dashboard, audit logging, SSO integration, webhook management, custom reporting, workflow automation, approval chains, document management, calendar scheduling, resource booking, inventory tracking, and a mobile-responsive admin panel.',
    expectedBehavior: 'Should handle gracefully, possibly prioritizing features',
    type: 'complex',
  },
  {
    id: 'edge-05',
    name: 'Non-App Request',
    prompt: 'Write me a poem about databases and tell me a joke about JavaScript',
    expectedBehavior: 'Should recognize this is not an app request and make assumptions',
    type: 'non-app',
  },
  {
    id: 'edge-06',
    name: 'Contradictory Roles',
    prompt: 'All users are administrators but some users have restricted access and cannot see certain pages. There should be no role system.',
    expectedBehavior: 'Should resolve contradiction by implementing a role system',
    type: 'contradictory',
  },
  {
    id: 'edge-07',
    name: 'Missing Core Concept',
    prompt: 'Payment system with invoices and receipts',
    expectedBehavior: 'Should infer users, products/services, and add necessary entities',
    type: 'incomplete',
  },
  {
    id: 'edge-08',
    name: 'Technical Jargon Mix',
    prompt: 'CRUD app with GraphQL subscriptions, REST endpoints, WebSocket real-time sync, MongoDB aggregation pipelines, and Redis caching layer',
    expectedBehavior: 'Should extract the core CRUD concept and simplify',
    type: 'technical',
  },
  {
    id: 'edge-09',
    name: 'Multi-language',
    prompt: 'App en español con panel de administración in English. Users pueden crear cuentas and manage their perfiles.',
    expectedBehavior: 'Should understand the mixed language and extract intent',
    type: 'multi-language',
  },
  {
    id: 'edge-10',
    name: 'Ambiguous Entities',
    prompt: 'Users can create things and share them with people who can then do stuff with those things. Some things are special and only certain people can see them.',
    expectedBehavior: 'Should ask for clarification or make assumptions about "things" and "people"',
    type: 'ambiguous',
  },
];

export const allTestCases = [...realProductPrompts, ...edgeCasePrompts];
