import { Elysia } from "elysia";
const app = new Elysia();
console.log('Has onRequest:', typeof app.onRequest);
console.log('Has onResponse:', typeof app.onResponse);
console.log('onRequest returns:', app.onRequest(() => {}));
console.log('onRequest returns onResponse:', typeof app.onRequest(() => {}).onResponse);
