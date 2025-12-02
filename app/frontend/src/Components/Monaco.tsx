import loader from "@monaco-editor/loader";
import { useEffect, useRef } from "react";

type Props = {
  source: string;
};

export default function Monaco({ source }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let editor: any;

    loader.init().then((monaco) => {
      editor = monaco.editor.create(containerRef.current!, {
        value: source,
        language: "markdown",
      });
      editor.onDidChangeModelContent(() => {
        source = editor.getValue();
      });
    });

    return () => {
      editor?.dispose();
    };
  }, [source]);

  return <div ref={containerRef} className="w-full h-full" />;
}
