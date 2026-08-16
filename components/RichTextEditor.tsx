import React, { useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

const BRAND = '#5A2D82';

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

// Native: react-native-pell-rich-editor (WebView-backed).
function NativeRichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const { RichEditor, RichToolbar, actions } = require('react-native-pell-rich-editor');
  const richText = useRef<any>(null);

  return (
    <View style={styles.nativeWrap}>
      <RichToolbar
        editor={richText}
        selectedIconTint={BRAND}
        iconTint="#6B7280"
        actions={[actions.setBold, actions.setItalic, actions.insertBulletsList]}
        style={styles.nativeToolbar}
      />
      <RichEditor
        ref={richText}
        initialContentHTML={value}
        onChange={onChange}
        placeholder={placeholder}
        editorStyle={{ contentCSSText: 'font-size: 15px; font-family: sans-serif; color: #17131C; padding: 4px 8px;' }}
        style={styles.nativeEditor}
      />
    </View>
  );
}

export default function RichTextEditor(props: RichTextEditorProps) {
  return Platform.OS === 'web' ? <WebRichTextEditor {...props} /> : <NativeRichTextEditor {...props} />;
}

const styles = StyleSheet.create({
  webWrap: { gap: 8 },
  toolbar: { flexDirection: 'row' },
  nativeWrap: { borderWidth: 1, borderColor: '#D8D2DC', borderRadius: 9, overflow: 'hidden' },
  nativeToolbar: { backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  nativeEditor: { minHeight: 100, backgroundColor: '#FFFFFF' },
});
