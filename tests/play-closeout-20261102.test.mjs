// Play release closeout (2026-11-02): fixes for the release audit 0.2.213 findings. On-device evidence: the emulator
// smoke and scripts/android_storage_check.mjs in CI (Android 10/11/13/16); project evidence PLAY_CLOSEOUT_METHODOLOGY_PARITY__20261102.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { serializeDiaryFile, parseDiaryFile } from '../app/js/diary/diary-file.js';
import { normalizeProgram } from '../app/js/core/program.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const PLUGIN = 'native/ft-billing/android/src/main/';

test('Android 6–10 «Сохранить в файл»: storage permissions only up to API 29, legacy storage for Android 10', () => {
  const manifest = read(PLUGIN + 'AndroidManifest.xml');
  for (const p of ['READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE'])
    assert.match(manifest, new RegExp(`<uses-permission android:name="android\\.permission\\.${p}" android:maxSdkVersion="29" />`), p);
  assert.doesNotMatch(manifest, /MANAGE_EXTERNAL_STORAGE|READ_MEDIA_/, 'no broad or media storage access');
  assert.match(manifest, /android:requestLegacyExternalStorage="true"/);
  // The app writes exactly here (Documents/Fight Tech), the path the permissions are for.
  assert.match(read('app/js/sharing/file-transfer.js'), /path:'Fight Tech\/'\+name,data:utf8Base64\(data\),directory:'DOCUMENTS'/);
});

test('Auto Backup stays on with explicit rules: the diaries and localStorage only, the same for Android ≤11 and 12+', () => {
  const manifest = read(PLUGIN + 'AndroidManifest.xml');
  assert.match(manifest, /android:fullBackupContent="@xml\/ft_backup_rules"/);
  assert.match(manifest, /android:dataExtractionRules="@xml\/ft_data_extraction_rules"/);
  assert.doesNotMatch(manifest, /allowBackup/, 'the app manifest keeps allowBackup="true" (owner: backup stays on)');
  const includes = xml => [...xml.matchAll(/<include domain="([a-z_]+)" path="([^"]+)" \/>/g)].map(m => m[1] + ':' + m[2]);
  const expected = ['file:.', 'root:app_webview/Default/Local Storage/', 'root:app_webview/Local Storage/'];
  const old = read(PLUGIN + 'res/xml/ft_backup_rules.xml');
  assert.deepEqual(includes(old), expected);
  const rules = read(PLUGIN + 'res/xml/ft_data_extraction_rules.xml');
  for (const section of ['cloud-backup', 'device-transfer']) {
    const body = rules.match(new RegExp(`<${section}>([\\s\\S]*?)</${section}>`))?.[1];
    assert.deepEqual(includes(body || ''), expected, section);
  }
  // Nothing limits when a backup is made (no requireFlags / encryption condition): the owner wants the diary to survive.
  assert.doesNotMatch(old + rules, /<exclude|requireFlags|disableIfNoEncryptionCapabilities/);
  // The diaries are files in the app's data folder (Directory.DATA = files/), the domain "file" above.
  assert.match(read('app/js/diary/store.js'), /directory: 'DATA', encoding: 'utf8', data: text/);
});

test('WebView usage statistics are not sent to Google', () => {
  assert.match(read(PLUGIN + 'AndroidManifest.xml'), /<meta-data android:name="android\.webkit\.WebView\.MetricsOptOut" android:value="true" \/>/);
});
