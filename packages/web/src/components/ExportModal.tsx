import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, X, Check } from "lucide-react";

interface Props {
  title: string;
  content: string;
  onClose: () => void;
}

export function ExportModal({ title, content, onClose }: Props) {
  const [text, setText] = useState(content);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <Card className="w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <CardContent className="pt-4 flex flex-col gap-3 flex-1 min-h-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{title}</h3>
            <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            className="flex-1 min-h-[200px] p-3 rounded-md border border-input bg-background text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            <Button size="sm" onClick={handleCopy}>
              {copied ? <><Check className="w-4 h-4 mr-1" /> Copied!</> : <><Copy className="w-4 h-4 mr-1" /> Copy</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
