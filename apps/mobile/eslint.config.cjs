const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettier,
  { ignores: ['dist/**', '.expo/**', 'expo-env.d.ts'] },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='style'] ObjectExpression",
          message: 'Mova o estilo para o arquivo .styles.ts do componente.',
        },
        {
          selector:
            "CallExpression[callee.object.name='StyleSheet'][callee.property.name='create']",
          message: 'StyleSheet.create pertence a um arquivo .styles.ts.',
        },
        {
          selector:
            "JSXOpeningElement[name.name='Pressable']:not(:has(JSXAttribute[name.name='accessibilityRole']))",
          message: 'Declare accessibilityRole para tornar esta ação acessível.',
        },
        {
          selector: "CallExpression[callee.name='fetch']",
          message: 'Mova o acesso HTTP para o serviço da funcionalidade.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['StyleSheet'],
              message: 'Importe StyleSheet somente no arquivo .styles.ts.',
            },
            {
              name: '@/lib/api-client',
              importNames: ['apiRequest'],
              message: 'A tela deve chamar o serviço da funcionalidade.',
            },
          ],
        },
      ],
    },
  },
]);
