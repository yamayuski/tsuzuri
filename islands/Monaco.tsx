import loader from "@monaco-editor/loader";
import type { Signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";

type Props = {
  source: Signal<string>;
};

export default function Monaco({ source }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let editor: any;

    loader.init().then((monaco) => {
      editor = monaco.editor.create(containerRef.current!, {
        value: source.value,
        language: "markdown",
      });
      editor.onDidChangeModelContent(() => {
        source.value = editor.getValue();
      });
    });

    return () => {
      editor?.dispose();
    };
  }, [source]);

  return <div ref={containerRef} class="w-full h-full" />;
}
