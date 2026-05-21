import { renderTiptap } from './tiptap.renderer';

describe('renderTiptap', () => {
  it('renders a paragraph with plain text', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
    };
    expect(renderTiptap(doc)).toBe('<p>Hello world</p>');
  });

  it('escapes HTML special characters in text', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '<b>bold</b> & "quoted"' }] }],
    };
    expect(renderTiptap(doc)).toBe('<p>&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;</p>');
  });

  it('renders a heading with the correct level', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] }],
    };
    expect(renderTiptap(doc)).toBe('<h2>Title</h2>');
  });

  it('applies bold and italic marks', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
        ],
      }],
    };
    expect(renderTiptap(doc)).toBe('<p><strong>bold</strong> and <em>italic</em></p>');
  });

  it('applies a link mark with href', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'click here', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] }],
      }],
    };
    expect(renderTiptap(doc)).toBe('<p><a href="https://example.com">click here</a></p>');
  });

  it('renders a bullet list', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
        ],
      }],
    };
    expect(renderTiptap(doc)).toBe('<ul><li><p>First</p></li><li><p>Second</p></li></ul>');
  });

  it('renders a hard break', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'line one' }, { type: 'hardBreak' }, { type: 'text', text: 'line two' }],
      }],
    };
    expect(renderTiptap(doc)).toBe('<p>line one<br>line two</p>');
  });

  it('renders children of unknown node types without crashing', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'unknownBlock',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'inside' }] }],
      }],
    };
    expect(renderTiptap(doc)).toBe('<p>inside</p>');
  });

  it('handles an empty doc', () => {
    expect(renderTiptap({ type: 'doc', content: [] })).toBe('');
  });
});
