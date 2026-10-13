import React, { useState, useRef, useCallback } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import d7Logo from "@assets/d7_imagem_1782243189521.jpg";

const queryClient = new QueryClient();

function ConverterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<"txt" | "demanda">("txt");
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "converting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateAndSetFile = (selectedFile: File) => {
    if (selectedFile.name.endsWith(".xls") || selectedFile.name.endsWith(".xlsx")) {
      setFile(selectedFile);
      setStatus("idle");
      setErrorMessage("");
    } else {
      setStatus("error");
      setErrorMessage("Formato inválido. Por favor, selecione um arquivo .xls ou .xlsx.");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setStatus("idle");
    setErrorMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleConvert = async () => {
    if (!file) return;

    setStatus("converting");
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("format", format);

      const response = await fetch(`${import.meta.env.BASE_URL}api/convert`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = "Ocorreu um erro ao converter o arquivo.";
        try {
          const { error } = await response.json();
          if (error) errorMsg = error;
        } catch (e) {
          // If not JSON or no error field
        }
        throw new Error(errorMsg);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Try to get filename from header
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      a.download = format === "demanda"
        ? `${file.name.replace(/\.[^.]+$/, "")} CDC.csv`
        : filenameMatch?.[1] ?? "D7-TECNOLOGIA.zip";
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus("success");
    } catch (error: any) {
      setStatus("error");
      setErrorMessage(error.message || "Erro desconhecido ao converter o arquivo.");
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50 font-sans text-slate-900">
      <header className="bg-slate-900 text-white p-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="rounded shrink-0 overflow-hidden">
            <img src={d7Logo} alt="D7 Tecnologia" className="h-10 w-10 object-cover" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Conversor D7 TECNOLOGIA</h1>
            <p className="text-xs text-slate-400 font-mono tracking-wider uppercase">Conversor de Planilhas</p>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto p-6 md:p-8 flex flex-col justify-center">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Upload de Arquivo</h2>
            <p className="text-sm text-slate-500">Selecione uma planilha do sistema e escolha o formato de saída.</p>
            <label htmlFor="output-format" className="block text-sm font-medium mt-5 mb-2">Formato de saída</label>
            <select
              id="output-format"
              value={format}
              disabled={status === "converting"}
              onChange={(event) => {
                setFormat(event.target.value as "txt" | "demanda");
                setStatus("idle");
                setErrorMessage("");
              }}
              className="w-full rounded-md border border-slate-300 bg-white p-3 text-sm"
            >
              <option value="txt">TXT — arquivos atuais em ZIP</option>
              <option value="demanda">CSV — Modelo de Demanda</option>
            </select>
            {format === "demanda" && (
              <div className="mt-3 rounded-md bg-cyan-50 p-3 text-sm text-slate-700">
                <p className="font-mono mb-2">Cod;Qtde;Marca;Tipo</p>
                <p>Código da empresa e quantidade da planilha. Marca: 1 (marca exata). Tipo: 1 (emergencial).</p>
              </div>
            )}
          </div>

          <div className="p-6 md:p-8">
            {status === "success" ? (
              <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="h-16 w-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Arquivo {format === "demanda" ? "CSV" : "ZIP"} gerado com sucesso!</h3>
                <p className="text-slate-500 mb-8 max-w-sm">
                  {format === "demanda" ? "O download do Modelo de Demanda foi iniciado, com Marca e Tipo fixos em 1." : "O processamento foi concluído e os arquivos TXT estão prontos para uso."}
                </p>
                <Button 
                  onClick={handleRemoveFile} 
                  variant="outline" 
                  className="font-medium px-8"
                  data-testid="button-convert-another"
                >
                  Converter outro arquivo
                </Button>
              </div>
            ) : status === "error" ? (
              <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Erro na conversão</h3>
                <div className="bg-red-50 text-red-700 text-sm p-4 rounded-md border border-red-100 w-full max-w-md text-left mb-8 font-mono overflow-auto">
                  {errorMessage}
                </div>
                <div className="flex gap-3">
                  <Button 
                    onClick={handleRemoveFile} 
                    variant="outline"
                    data-testid="button-cancel-error"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleConvert} 
                    className="bg-cyan-600 hover:bg-cyan-700 text-white"
                    data-testid="button-retry"
                  >
                    Tentar Novamente
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                {!file ? (
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-10 transition-colors flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 ${
                      isDragging ? "border-cyan-500 bg-cyan-50" : "border-slate-300"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="dropzone-area"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={handleFileSelect}
                      data-testid="input-file"
                    />
                    <div className={`p-4 rounded-full mb-4 ${isDragging ? "bg-cyan-100" : "bg-slate-100"}`}>
                      <Upload className={`h-8 w-8 ${isDragging ? "text-cyan-600" : "text-slate-500"}`} />
                    </div>
                    <h3 className="text-base font-medium text-slate-900 mb-1">
                      Clique ou arraste um arquivo aqui
                    </h3>
                    <p className="text-sm text-slate-500">
                      Apenas arquivos .xls e .xlsx são aceitos
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg p-4 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="bg-cyan-100 p-2.5 rounded-md shrink-0">
                        <FileSpreadsheet className="h-6 w-6 text-cyan-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-slate-400 hover:text-red-500 hover:bg-red-50 ml-4"
                      onClick={handleRemoveFile}
                      disabled={status === "converting"}
                      data-testid="button-remove-file"
                      title="Remover arquivo"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                )}

                <div className="pt-4 flex justify-end">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto font-medium px-8 bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm"
                    onClick={handleConvert}
                    disabled={!file || status === "converting"}
                    data-testid="button-converter"
                  >
                    {status === "converting" ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Convertendo...
                      </>
                    ) : (
                      "Converter"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ConverterPage} />
      <Route>
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900">
          <p>Página não encontrada.</p>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
