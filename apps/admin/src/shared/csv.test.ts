import assert from 'node:assert/strict';
import test from 'node:test';
import { csvCell, reportsToCsv } from './csv.ts';

test('célula neutraliza fórmulas e dobra aspas', () => {
  assert.equal(csvCell('=HIPERLINK("x")'), '"\'=HIPERLINK(""x"")"');
  assert.equal(csvCell('+55 11'), '"\'+55 11"');
  assert.equal(csvCell('Rua A, 10'), '"Rua A, 10"');
  assert.equal(csvCell(-23.5), '"\'-23.5"');
});

test('arquivo começa com BOM e cabeçalho em português', () => {
  const csv = reportsToCsv([]);
  assert.ok(csv.startsWith('﻿"Protocolo do painel";"Tipo"'));
});
