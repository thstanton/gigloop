import { escapeHtml, plainTextToHtml } from './html';

describe('escapeHtml', () => {
  it('escapes the characters that could open a tag or attribute', () => {
    expect(escapeHtml('<b>a & "b"</b>')).toBe('&lt;b&gt;a &amp; &quot;b&quot;&lt;/b&gt;');
  });

  it('escapes the ampersand first so entities are not double-broken', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});

describe('plainTextToHtml', () => {
  it('escapes markup but keeps line breaks as <br>', () => {
    expect(plainTextToHtml('NOTES\n<b>hi</b>')).toBe('NOTES<br>&lt;b&gt;hi&lt;/b&gt;');
  });
});
