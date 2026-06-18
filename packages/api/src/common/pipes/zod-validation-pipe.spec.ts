import { Controller, Post, Body, INestApplication, UsePipes } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import { z } from 'zod';

const testSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  age: z.number().min(18, 'Must be at least 18'),
  preferences: z
    .object({
      newsletter: z.boolean(),
    })
    .optional(),
});

class TestDto extends createZodDto(testSchema) {}

@Controller('test')
class TestController {
  /** Parameter-level pipe: Vitest does not emit `design:paramtypes`, so global pipe cannot infer DTOs here. */
  @Post()
  @UsePipes(new ZodValidationPipe(TestDto))
  create(@Body() body: TestDto) {
    return { success: true, data: body };
  }
}

describe('ZodValidationPipe (HTTP level)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should pass validation for valid payload', async () => {
    const response = await request(app.getHttpServer())
      .post('/test')
      .send({ name: 'Alice', age: 30 })
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      data: { name: 'Alice', age: 30 },
    });
  });

  it('should return 400 Bad Request with expected format for invalid payload', async () => {
    const response = await request(app.getHttpServer())
      .post('/test')
      .send({ name: 'Al', age: 17 })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
    expect(response.body.message).toBe('Validation failed');

    const errorBlob = JSON.stringify(response.body.errors ?? response.body);
    expect(errorBlob).toContain('Name must be at least 3 characters');
    expect(errorBlob).toContain('Must be at least 18');
  });
});
