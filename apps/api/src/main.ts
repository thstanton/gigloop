import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: 'http://localhost:5173' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('GigMan API')
    .setDescription('CRM for musicians — all endpoints require a Clerk JWT bearer token')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Clerk session token' },
      'clerk-jwt',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  app.use('/openapi.json', (_req: unknown, res: { setHeader: Function; send: Function }) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(document);
  });

  app.use('/docs', (_req: unknown, res: { setHeader: Function; send: Function }) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!doctype html>
<html>
  <head>
    <title>GigMan API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`);
  });

  await app.listen(3000);
}
bootstrap();
