import { z } from 'zod';
const schema = z.object({
  customer: z.object({
    email: z
      .union([z.string().email(), z.literal('')])
      .optional()
      .nullable(),
  }),
});

const result = schema.safeParse({ customer: { email: '' } });
console.dir(result, { depth: null });
