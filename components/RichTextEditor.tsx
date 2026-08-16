import React, { useRef } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

// Web: a contentEditable div with a tiny execCommand-driven toolbar.
function WebRichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  const exec = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  return (
    <View style={styles.webWrap}>
      <View style={styles.toolbar}>
        {[
          { cmd: 'bold', label: 'B', style: { fontWeight: '700' as const } },
          { cmd: 'italic', label: 'I', style: { fontStyle: 'italic' as const } },
          { cmd: 'insertUnorderedList', label: '• List', style: {} },
        ].map((btn) => (
          // @ts-ignore - button is a valid DOM element on web
          <button
            key={btn.cmd}
            type="button"
            onClick={() => exec(btn.cmd)}
            style={{
              border: '1px solid #D8D2DC',
              borderRadius: 7,
              padding: '6px 12px',
              marginRight: 6,
              background: '#FFFFFF',
              color: '#374151',
              fontSize: 13,
              cursor: 'pointer',
              ...btn.style,
            }}
          >
            {btn.label}
          </button>
        ))}
      </View>
      {/* @ts-ignore - div is a valid DOM element on web */}
      <div
        ref={editorRef}
        contentEditable
        onInput={(e: any) => onChange(e.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: value }}
        data-placeholder={placeholder}
        style={{
          minHeight: 90,
          border: '1px solid #D8D2DC',
          borderRadius: 9,
          padding: '10px 14px',
          fontSize: 15,
          fontFamily: 'Inter-Regular, sans-serif',
          color: '#17131C',
          outline: 'none',
          background: '#FFFFFF',
        }}
      />
    </View>
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n+$/, '');
}

function plainTextToHtml(text: string): string {
  return text.split('\n').map((line) => `<p>${line ? escapeHtml(line) : '<br/>'}</p>`).join('');
}

// Native: a plain multiline input. A WebView-based rich editor previously
// lived here but crashed the app on Android under React Native's New
// Architecture, so formatting (bold/italic/lists) is web-admin-only for now -
// native just edits/stores the same HTML as plain text (newlines preserved).
function NativeRichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  return (
    <View>
      <TextInput
        style={styles.nativeInput}
        value={htmlToPlainText(value)}
        onChangeText={(t) => onChange(plainTextToHtml(t))}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />
      <Text style={styles.nativeHint}>Bold, italics, and bullet lists are available when editing from the web admin.</Text>
    </View>
  );
}

export default function RichTextEditor(props: RichTextEditorProps) {
  return Platform.OS === 'web' ? <WebRichTextEditor {...props} /> : <NativeRichTextEditor {...props} />;
}

const styles = StyleSheet.create({
  webWrap: { gap: 8 },
  toolbar: { flexDirection: 'row' },
  nativeInput: {
    minHeight: 90, borderWidth: 1, borderColor: '#D8D2DC', borderRadius: 9,
    paddingHorizontal: 14, paddingVertical: 10, fontFamily: 'Inter-Regular', fontSize: 15,
    color: '#17131C', backgroundColor: '#FFFFFF',
  },
  nativeHint: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#9CA3AF', marginTop: 6 },
});
