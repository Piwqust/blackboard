import js from '@eslint/js';
import globals from 'globals';
export default [
  {ignores:['**/.wrangler/**','**/*.d.ts','.tmp/**','dist/**','node_modules/**','test-results/**','docs/**','.claude/**','.playwright-cli/**']},
  {files:['**/*.js','**/*.mjs'], ...js.configs.recommended, languageOptions:{ecmaVersion:'latest',sourceType:'module',globals:{...globals.browser,...globals.node,...globals.webextensions,...globals.serviceworker}},rules:{...js.configs.recommended.rules,'no-unused-vars':['error',{args:'none',caughtErrors:'none',ignoreRestSiblings:true,varsIgnorePattern:'^_'}],'preserve-caught-error':'off','no-empty':['error',{allowEmptyCatch:true}]}}
];
