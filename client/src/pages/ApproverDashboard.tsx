import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import DocumentTable, { Document } from "@/components/DocumentTable";
import ApprovalDialog from "@/components/ApprovalDialog";
import DocumentViewDialog from "@/components/DocumentViewDialog";
import WorkflowProgress from "@/components/WorkflowProgress";
import { WordDocumentViewer } from "@/components/WordDocumentViewer";
import PDFViewer from "@/components/PDFViewer";
import ActivityFeed, { buildActivitiesFromDocs } from "@/components/ActivityFeed";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { DocumentStatus } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpDown, Filter, XCircle, Clock, CheckCircle, FileText, Download, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ApproverDashboardProps {
  onLogout?: () => void;
  userId?: string;
  userName?: string;
  approverName?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentCode?: string | null;
  masterCopyAccess?: boolean;
}

interface ApiDocument {
  id: string;
  docName: string;
  docNumber: string;
  status: string;
  dateOfIssue: string;
  revisionNo: number;
  preparedBy: string;
  preparerName?: string;
  approverName?: string;
  issuerName?: string;
  departments?: Array<{ id: string; name: string; code?: string }>;
  approvedAt?: string;
  issuedAt?: string;
  createdAt?: string;
  location?: string;
  dateOfRev?: string;
  creatorDepartmentId?: string | null;
  creatorDepartmentCode?: string | null;
  creatorDepartmentName?: string | null;
}

interface Notification {
  id: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

// 12 Production departments that share a single approver (Mr. Hemant Khariwale - production@neelikon.com)
export const PRODUCTION_CLUSTER_DEPARTMENTS = [
  "Production",
  "Production Group – III",
  "Production Group - III",
  "Production Group – IV",
  "Production Group - IV",
  "Production Group – V",
  "Production Group - V",
  "Production Group – VI",
  "Production Group - VI",
  "Plant – A / E & G",
  "Plant - A / E & G",
  "Plant A/E&G",
  "Plant – B",
  "Plant - B",
  "Plant – B1",
  "Plant - B1",
  "Plant – C & D",
  "Plant - C & D",
  "Plant C&D",
  "Plant – F",
  "Plant - F",
  "Blending & Processing",
  "Production Plant - C",
  "Production Plant-C"
];

export const PRODUCTION_CLUSTER_PREPARER_EMAILS = [
  "productioncommon@neelikon.com",
  "ravindra.k@neelikon.com",
  "sanjaybhoir@neelikon.com",
  "mahesh@neelikon.com",
  "devendra.patil@neelikon.com",
  "kunal.pimple@neelikon.com",
  "manojpatil@neelikon.com",
  "jagtap@neelikon.com",
  "almeida@neelikon.com",
  "malekar@neelikon.com",
  "parte@neelikon.com",
  "rakeshparte@neelikon.com",
  "nitinpatil@neelikon.com"
];

export const PRODUCTION_CLUSTER_DEPT_IDS = [
  "prod-1", "prod-3", "prod-4", "prod-5", "prod-6",
  "plant-a-eg", "plant-b", "plant-b1", "plant-cd", "plant-f",
  "ops-blending",
  "dept-2", "dept-3", "dept-4", "dept-5", "dept-6",
  "dept-7", "dept-8", "dept-9", "dept-10", "dept-11", "dept-12"
];

export const PRODUCTION_CLUSTER_CODES = [
  "PROD", "PROD-III", "PROD-IV", "PROD-V", "PROD-VI",
  "PLT-AEG", "PLT-B", "PLT-B1", "PLT-CD", "PLT-F", "OPS-BLP"
];

export function normalizeString(str?: string | null): string {
  if (!str) return "";
  return str.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
}

export function isProductionClusterDepartment(deptId?: string | null, deptName?: string | null, deptCode?: string | null): boolean {
  // Explicitly exclude Production Group II
  if (deptId && (deptId.toLowerCase() === "prod-2" || deptId.toLowerCase() === "dept-1")) {
    return false;
  }
  if (deptCode && deptCode.toUpperCase() === "PROD-II") {
    return false;
  }
  if (deptName) {
    const norm = normalizeString(deptName);
    if (norm.includes("group ii") || norm.includes("group - ii") || norm.includes("group-ii") || norm.includes("group 2")) {
      return false;
    }
  }

  if (deptId && PRODUCTION_CLUSTER_DEPT_IDS.includes(deptId.toLowerCase())) {
    return true;
  }
  if (deptCode && PRODUCTION_CLUSTER_CODES.includes(deptCode.toUpperCase())) {
    return true;
  }
  if (deptName) {
    const norm = normalizeString(deptName);
    if (
      norm === "production" ||
      norm.startsWith("production group - iii") || norm.startsWith("production group iii") ||
      norm.startsWith("production group - iv") || norm.startsWith("production group iv") ||
      norm.startsWith("production group - v") || norm.startsWith("production group v") ||
      norm.startsWith("production group - vi") || norm.startsWith("production group vi") ||
      norm.startsWith("production plant - c") || norm.startsWith("production plant-c") || norm.startsWith("production plant c") ||
      norm.startsWith("plant - a") || norm.startsWith("plant a") ||
      norm.startsWith("plant - b") || norm.startsWith("plant b") ||
      norm.startsWith("plant - c") || norm.startsWith("plant c") ||
      norm.startsWith("plant - f") || norm.startsWith("plant f") ||
      norm.includes("blending & processing") || norm.includes("blending and processing")
    ) {
      return true;
    }
  }
  return false;
}

export function isProductionClusterDoc(doc: ApiDocument): boolean {
  if (!doc) return false;

  // Explicitly reject Production Group II
  const allDeptNames = [
    doc.creatorDepartmentName,
    (doc as any).creatorData?.departmentName,
    ...(doc.departments || []).map(d => d.name)
  ].filter(Boolean);

  if (allDeptNames.some(name => {
    const norm = normalizeString(name);
    return norm.includes("group ii") || norm.includes("group - ii") || norm.includes("group-ii") || norm.includes("group 2");
  })) {
    return false;
  }

  const allDeptIds = [
    doc.creatorDepartmentId,
    (doc as any).creatorData?.departmentId,
    ...(doc.departments || []).map(d => d.id)
  ].filter(Boolean);

  if (allDeptIds.some(id => id && (id.toLowerCase() === "prod-2" || id.toLowerCase() === "dept-1"))) {
    return false;
  }

  // Check if explicitly from another known department (e.g. EHS)
  const docNum = (doc.docNumber || "").toUpperCase();
  const creatorCode = (doc.creatorDepartmentCode || "").toUpperCase();
  const creatorName = normalizeString(doc.creatorDepartmentName || (doc as any).creatorData?.departmentName);

  if (
    creatorCode === "EHS" ||
    creatorName.includes("e.h.s") ||
    creatorName.includes("ehs") ||
    docNum.includes("/EHS/") ||
    docNum.startsWith("EHS-")
  ) {
    return false;
  }

  // 1. Check creator department id, code, or name
  if (isProductionClusterDepartment(doc.creatorDepartmentId, doc.creatorDepartmentName, doc.creatorDepartmentCode)) {
    return true;
  }

  // 2. Check doc.creatorData
  const creatorData = (doc as any).creatorData;
  if (creatorData) {
    if (isProductionClusterDepartment(creatorData.departmentId, creatorData.departmentName, creatorData.departmentCode)) {
      return true;
    }
    if (creatorData.username && PRODUCTION_CLUSTER_PREPARER_EMAILS.includes(creatorData.username.toLowerCase().trim())) {
      return true;
    }
  }

  // 3. Check preparedBy or preparerName matching production preparers
  const prep = (doc.preparedBy || "").toLowerCase().trim();
  if (PRODUCTION_CLUSTER_PREPARER_EMAILS.some(email => prep === email || prep.includes(email.split('@')[0]))) {
    return true;
  }

  const prepName = normalizeString(doc.preparerName);
  if (
    prepName.includes("ravindra") ||
    prepName.includes("sanjay") ||
    prepName.includes("mahesh") ||
    prepName.includes("devendra") ||
    prepName.includes("kunal") ||
    prepName.includes("jagtap") ||
    prepName.includes("almeida") ||
    prepName.includes("malekar") ||
    prepName.includes("parte") ||
    prepName.includes("nitin") ||
    prepName === "production"
  ) {
    return true;
  }

  // 4. Check document number pattern for Production
  if (
    docNum.includes("/PROD/") ||
    docNum.includes("/PLT-") ||
    docNum.includes("/OPS-BLP/") ||
    docNum.startsWith("PROD-")
  ) {
    return true;
  }

  return false;
}

export default function ApproverDashboard({
  onLogout,
  userId = "approver-1",
  userName = "",
  approverName = "",
  departmentId = null,
  departmentName = null,
  departmentCode = null,
  masterCopyAccess = false
}: ApproverDashboardProps) {
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [wordViewerOpen, setWordViewerOpen] = useState(false);
  const [wordViewDocId, setWordViewDocId] = useState<string>("");
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfDocId, setPdfDocId] = useState<string>("");
  const [pdfDocName, setPdfDocName] = useState<string>("");
  const [selectedDoc, setSelectedDoc] = useState<ApiDocument | null>(null);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Identify whether the logged-in approver is the designated Production Approver for the 12 departments
  const isProductionApprover = useMemo(() => {
    const normDept = (departmentName || "").toLowerCase().replace(/[–—]/g, '-').trim();
    const normUser = (userName || "").toLowerCase().trim();
    const normName = (approverName || "").toLowerCase().trim();
    const normCode = (departmentCode || "").toUpperCase().trim();

    return (
      normUser === "production@neelikon.com" ||
      normUser.startsWith("production@") ||
      normName.includes("hemant") ||
      normName.includes("khariwale") ||
      normCode === "PROD" ||
      normDept === "production" ||
      normDept === "prod" ||
      departmentId === "prod-1" ||
      departmentId === "dept-1"
    );
  }, [departmentName, userName, approverName, departmentCode, departmentId]);

  const { data: pendingDocs = [], isLoading: isLoadingDocs } = useQuery<ApiDocument[]>({
    queryKey: ["/api/documents", "pending", isProductionApprover ? "production-cluster" : departmentId],
    queryFn: async () => {
      const url = isProductionApprover
        ? "/api/documents?status=pending"
        : (departmentId
          ? `/api/documents/department/${departmentId}?status=pending`
          : "/api/documents?status=pending");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch documents");
      const docs: ApiDocument[] = await response.json();
      if (isProductionApprover) {
        return docs.filter(isProductionClusterDoc);
      }
      return docs;
    },
    refetchInterval: 5000,
  });

  const { data: approvedDocs = [] } = useQuery<ApiDocument[]>({
    queryKey: ["/api/documents", "approved", isProductionApprover ? "production-cluster" : departmentId],
    queryFn: async () => {
      const url = isProductionApprover
        ? "/api/documents?status=approved"
        : (departmentId
          ? `/api/documents/department/${departmentId}?status=approved`
          : "/api/documents?status=approved");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch documents");
      const docs: ApiDocument[] = await response.json();
      if (isProductionApprover) {
        return docs.filter(isProductionClusterDoc);
      }
      return docs;
    },
  });

  const { data: issuedDocuments = [] } = useQuery<ApiDocument[]>({
    queryKey: ["/api/documents", "issued", isProductionApprover ? "production-cluster" : departmentId],
    queryFn: async () => {
      const url = isProductionApprover
        ? "/api/documents?status=issued"
        : (departmentId
          ? `/api/documents/department/${departmentId}?status=issued`
          : "/api/documents?status=issued");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch issued documents");
      const docs: ApiDocument[] = await response.json();
      if (isProductionApprover) {
        return docs.filter(isProductionClusterDoc);
      }
      return docs;
    },
    refetchInterval: 5000,
  });

  const { data: allIssuedDocuments = [], isLoading: allIssuedLoading } = useQuery<ApiDocument[]>({
    queryKey: ["/api/documents", "all-issued-approver"],
    queryFn: async () => {
      const response = await fetch(`/api/documents?status=issued`);
      if (!response.ok) throw new Error("Failed to fetch all issued documents");
      return response.json();
    },
    refetchInterval: 10000,
  });

  const { data: declinedDocs = [] } = useQuery<ApiDocument[]>({
    queryKey: ["/api/documents", "declined", isProductionApprover ? "production-cluster" : departmentId],
    queryFn: async () => {
      const url = isProductionApprover
        ? "/api/documents?status=declined"
        : (departmentId
          ? `/api/documents/department/${departmentId}?status=declined`
          : "/api/documents?status=declined");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch declined documents");
      const docs: ApiDocument[] = await response.json();
      if (isProductionApprover) {
        return docs.filter(isProductionClusterDoc);
      }
      return docs;
    },
    refetchInterval: 10000,
  });

  const { data: obsoleteDocs = [] } = useQuery<ApiDocument[]>({
    queryKey: ["/api/documents", "obsolete", isProductionApprover ? "production-cluster" : departmentId],
    queryFn: async () => {
      const url = isProductionApprover
        ? "/api/documents?status=obsolete"
        : (departmentId
          ? `/api/documents/department/${departmentId}?status=obsolete`
          : "/api/documents?status=obsolete");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch obsolete documents");
      const docs: ApiDocument[] = await response.json();
      if (isProductionApprover) {
        return docs.filter(isProductionClusterDoc);
      }
      return docs;
    },
    refetchInterval: 10000,
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", userId],
    queryFn: async () => {
      const response = await fetch(`/api/notifications/${userId}`);
      if (!response.ok) throw new Error("Failed to fetch notifications");
      return response.json();
    },
    refetchInterval: 5000,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["/api/departments"],
    queryFn: async () => {
      const response = await fetch("/api/departments");
      if (!response.ok) throw new Error("Failed to fetch departments");
      return response.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (data: {
      documentId: string;
      approvalRemarks: string;
      departments: string[];
      approverName: string
    }) => {
      const response = await fetch(`/api/documents/${data.documentId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalRemarks: data.approvalRemarks,
          approvedBy: userId,
          approverName: data.approverName,
          departments: data.departments,
        }),
      });
      if (!response.ok) throw new Error("Failed to approve document");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document Approved",
        description: "The document has been successfully approved and sent to the issuer.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (data: { documentId: string; declineRemarks: string }) => {
      const response = await fetch(`/api/documents/${data.documentId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          declineRemarks: data.declineRemarks,
          declinedBy: userId,
          declinerName: approverName
        }),
      });
      if (!response.ok) throw new Error("Failed to decline document");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document Declined",
        description: "The document has been sent back to the creator for revision.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to decline document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleView = (doc: Document) => {
    setViewDoc(doc);
    setViewDialogOpen(true);
  };

  const handleViewPDF = (doc: Document) => {
    setPdfDocId(doc.id);
    setPdfDocName(doc.docName);
    setPdfViewerOpen(true);
  };

  const handleViewWord = (doc: Document) => {
    setWordViewDocId(doc.id);
    setWordViewerOpen(true);
  };

  const handleDownload = async (doc: Document) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/download`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to download document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.docNumber}_${doc.docName}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Started",
        description: `Downloading ${doc.docName} as Word document...`,
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download Word document",
        variant: "destructive",
      });
    }
  };

  const handleApprove = (doc: Document) => {
    const fullDoc = pendingDocs.find(d => d.id === doc.id) || doc as unknown as ApiDocument;
    setSelectedDoc(fullDoc);
    setApproveDialogOpen(true);
  };

  const handleDecline = (doc: Document) => {
    const fullDoc = pendingDocs.find(d => d.id === doc.id) || doc as unknown as ApiDocument;
    setSelectedDoc(fullDoc);
    setDeclineDialogOpen(true);
  };


  const todayApproved = approvedDocs.filter(doc => {
    const approvedDate = doc.approvedAt ? new Date(doc.approvedAt) : null;
    const today = new Date();
    return approvedDate &&
      approvedDate.getDate() === today.getDate() &&
      approvedDate.getMonth() === today.getMonth() &&
      approvedDate.getFullYear() === today.getFullYear();
  }).length;

  // Helper to check if a document was created by user's department
  const isCreatedByMyDept = (doc: ApiDocument) => {
    if (!doc) return false;
    if (isProductionApprover) {
      return isProductionClusterDoc(doc);
    }
    const matchesDeptId = departmentId && doc.creatorDepartmentId && String(doc.creatorDepartmentId) === String(departmentId);
    const matchesDeptCode = departmentCode && doc.creatorDepartmentCode && String(doc.creatorDepartmentCode).toLowerCase() === String(departmentCode).toLowerCase();
    const matchesDeptName = departmentName && (doc as any).creatorDepartmentName && String((doc as any).creatorDepartmentName).toLowerCase() === String(departmentName).toLowerCase();
    return Boolean(matchesDeptId || matchesDeptCode || matchesDeptName);
  };

  // Helper to check if user's department is in doc.departments
  const isDeptInDocDepartments = (doc: ApiDocument) => {
    if (!doc || !doc.departments || !Array.isArray(doc.departments) || doc.departments.length === 0) return false;
    if (isProductionApprover) {
      return doc.departments.some(d => isProductionClusterDepartment(d.id, d.name, d.code));
    }
    return doc.departments.some(d => {
      const idMatch = departmentId && d.id && String(d.id) === String(departmentId);
      const codeMatch = departmentCode && d.code && String(d.code).toLowerCase() === String(departmentCode).toLowerCase();
      const nameMatch = departmentName && d.name && String(d.name).toLowerCase() === String(departmentName).toLowerCase();
      return Boolean(idMatch || codeMatch || nameMatch);
    });
  };

  // Check if document is specifically for my department (only assigned to my department / production cluster, not combined with outside departments)
  const isSpecificToMyDept = (doc: ApiDocument) => {
    if (!doc || !doc.departments || !Array.isArray(doc.departments) || doc.departments.length === 0) return false;
    if (isProductionApprover) {
      // Must ONLY be assigned to production cluster departments (no outside / combine departments)
      return doc.departments.every(d => isProductionClusterDepartment(d.id, d.name, d.code));
    }
    if (doc.departments.length === 1) {
      return isDeptInDocDepartments(doc);
    }
    return false;
  };

  // Check if document is visible to my department (own dept OR shared with my dept)
  const isVisibleToMyDept = (doc: ApiDocument) => {
    if (isProductionApprover) {
      return isProductionClusterDoc(doc) || isDeptInDocDepartments(doc);
    }
    if (!departmentId && !departmentCode) return true; // System admin / no dept
    return isCreatedByMyDept(doc) || isDeptInDocDepartments(doc);
  };

  // My Department documents:
  // 1. Created by my department (or Production cluster)
  // 2. OR shared specifically only with my department (not combined across multiple outside departments)
  const isMyDeptDoc = (doc: ApiDocument) => {
    if (!doc) return false;
    if (!departmentId && !departmentCode && !isProductionApprover) return true;
    if (isCreatedByMyDept(doc)) return true;
    if (isSpecificToMyDept(doc)) return true;
    return false;
  };

  // Other Department documents:
  // Must NOT be my department doc, but MUST be shared with my department
  // (e.g. combined/multiple departments where my department is included, or created by other dept and shared with us)
  const isOtherDeptDoc = (doc: ApiDocument) => {
    if (!doc) return false;
    if (!departmentId && !departmentCode && !isProductionApprover) return false;
    if (isMyDeptDoc(doc)) return false;
    return isDeptInDocDepartments(doc);
  };

  const allRelevantIssuedDocs = useMemo(() => {
    const combined = [...issuedDocuments, ...allIssuedDocuments];
    const unique = new Map<string, ApiDocument>();
    combined.forEach(doc => {
      if (doc && doc.id && isVisibleToMyDept(doc)) {
        unique.set(doc.id, doc);
      }
    });
    return Array.from(unique.values());
  }, [issuedDocuments, allIssuedDocuments, departmentId, departmentCode, departmentName, isProductionApprover]);

  const myDeptDocs = useMemo(() => {
    return allRelevantIssuedDocs.filter(isMyDeptDoc);
  }, [allRelevantIssuedDocs, departmentId, departmentCode, departmentName, isProductionApprover]);

  const otherDeptDocs = useMemo(() => {
    return allRelevantIssuedDocs.filter(isOtherDeptDoc);
  }, [allRelevantIssuedDocs, departmentId, departmentCode, departmentName, isProductionApprover]);

  const sortDocs = (docs: ApiDocument[]) => {
    return [...docs].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();

      if (sortBy === "newest") return dateB - dateA;
      if (sortBy === "oldest") return dateA - dateB;
      if (sortBy === "doc-asc") return (a.docNumber || "").localeCompare(b.docNumber || "");
      if (sortBy === "doc-desc") return (b.docNumber || "").localeCompare(a.docNumber || "");
      return 0;
    });
  };

  const transformAndFilter = (docs: ApiDocument[]): Document[] => {
    let list = docs;
    if (isProductionApprover && selectedDepartmentFilter && selectedDepartmentFilter !== "all") {
      list = list.filter(d => {
        const dName = normalizeString(d.creatorDepartmentName || (d.departments && d.departments[0]?.name) || "");
        const target = normalizeString(selectedDepartmentFilter);
        const matchesCreator = dName === target || dName.includes(target);
        const matchesAssigned = (d.departments || []).some(dept => {
          const name = normalizeString(dept.name);
          return name === target || name.includes(target);
        });
        return matchesCreator || matchesAssigned;
      });
    }

    const sorted = sortDocs(list);
    const filtered = !searchQuery ? sorted : sorted.filter(d =>
      (d.docName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.docNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.preparerName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.creatorDepartmentName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.departments || []).some(dept => dept.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return filtered.map(doc => {
      const depts = (doc.departments && doc.departments.length > 0)
        ? doc.departments
        : (doc.creatorDepartmentName ? [{ id: doc.creatorDepartmentId || '', name: doc.creatorDepartmentName }] : []);

      return {
        id: doc.id,
        docName: doc.docName,
        docNumber: doc.docNumber,
        status: (doc.status.charAt(0).toUpperCase() + doc.status.slice(1)) as DocumentStatus,
        dateOfIssue: doc.dateOfIssue ? new Date(doc.dateOfIssue).toISOString().split('T')[0] : '',
        revisionNo: doc.revisionNo,
        preparedBy: doc.preparerName || 'Unknown',
        location: doc.location,
        dateOfRev: doc.dateOfRev ? new Date(doc.dateOfRev).toISOString().split('T')[0] : null,
        departments: depts
      };
    });
  };

  const unreadNotifications = notifications.filter(n => !n.isRead).length;

  const allDocsForActivity = useMemo(() => {
    const map = new Map<string, ApiDocument>();
    (pendingDocs || []).forEach(d => d?.id && map.set(d.id, d));
    (approvedDocs || []).forEach(d => d?.id && !map.has(d.id) && map.set(d.id, d));
    (declinedDocs || []).forEach(d => d?.id && !map.has(d.id) && map.set(d.id, d));
    (issuedDocuments || []).forEach(d => d?.id && !map.has(d.id) && map.set(d.id, d));
    (allIssuedDocuments || []).forEach(d => d?.id && !map.has(d.id) && map.set(d.id, d));
    return Array.from(map.values()).filter(isVisibleToMyDept);
  }, [pendingDocs, approvedDocs, declinedDocs, issuedDocuments, allIssuedDocuments, departmentId, departmentCode, departmentName]);

  const activities = useMemo(() => {
    return buildActivitiesFromDocs(allDocsForActivity, isMyDeptDoc);
  }, [allDocsForActivity, isMyDeptDoc]);

  return (
    <DashboardLayout
      userRole="Document Approver"
      userName={approverName}
      userId={userId}
      notificationCount={unreadNotifications}
      onLogout={onLogout}
    >
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">
              Approver Dashboard ({approverName || "User"} - {isProductionApprover ? "Production Cluster (12 Departments)" : (departmentName || "No Department")})
            </h2>
            {isProductionApprover && (
              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                Single Approver (12 Depts)
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isProductionApprover
              ? "Single approver oversight for all 12 production departments including Production Plant - C"
              : "Complete document oversight and approval workflow"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <StatCard
            title="Pending Approval"
            value={pendingDocs.length}
            icon={Clock}
            variant="amber"
          />
          <StatCard
            title="Approved Today"
            value={todayApproved}
            icon={CheckCircle}
            variant="green"
          />
          <StatCard
            title="Declined"
            value={declinedDocs.length}
            icon={XCircle}
            variant="red"
          />
          <StatCard
            title="Total Reviewed"
            value={approvedDocs.length + pendingDocs.length + declinedDocs.length}
            icon={FileText}
            variant="blue"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-3 space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-end md:items-center justify-between mb-2">
              <div className="relative flex-1 max-w-sm w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  className="pl-9 h-9 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {isProductionApprover && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">Filter Dept:</span>
                    <Select value={selectedDepartmentFilter} onValueChange={setSelectedDepartmentFilter}>
                      <SelectTrigger className="h-8 w-[170px] text-[11px]">
                        <SelectValue placeholder="All 12 Departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All 12 Departments</SelectItem>
                        <SelectItem value="Production">Production</SelectItem>
                        <SelectItem value="Production Group - III">Production Group – III</SelectItem>
                        <SelectItem value="Production Group - IV">Production Group – IV</SelectItem>
                        <SelectItem value="Production Group - V">Production Group – V</SelectItem>
                        <SelectItem value="Production Group - VI">Production Group – VI</SelectItem>
                        <SelectItem value="Plant - A / E & G">Plant – A / E & G</SelectItem>
                        <SelectItem value="Plant - B">Plant – B</SelectItem>
                        <SelectItem value="Plant - B1">Plant – B1</SelectItem>
                        <SelectItem value="Plant - C & D">Plant – C & D</SelectItem>
                        <SelectItem value="Plant - F">Plant – F</SelectItem>
                        <SelectItem value="Blending & Processing">Blending & Processing</SelectItem>
                        <SelectItem value="Production Plant - C">Production Plant - C</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">Sort By:</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-8 w-[140px] text-[11px]">
                    <SelectValue placeholder="Sort order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="doc-asc">Document No. (A-Z)</SelectItem>
                    <SelectItem value="doc-desc">Document No. (Z-A)</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 font-bold">
                  <Download className="w-3.5 h-3.5" />
                  <span className="text-xs">Export Log</span>
                </Button>
              </div>
            </div>

            <Card className="p-3.5 border-slate-200">
              <Tabs defaultValue="pending" className="w-full">
                <TabsList className="bg-slate-100 p-0.5 h-9 mb-4 flex-wrap">
                  <TabsTrigger value="my-department" className="text-xs h-8 px-3">My Department Document ({myDeptDocs.length})</TabsTrigger>
                  <TabsTrigger value="other-department" className="text-xs h-8 px-3">Other Department Document ({otherDeptDocs.length})</TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs h-8 px-3 font-bold text-amber-700">Pending ({pendingDocs.length})</TabsTrigger>
                  <TabsTrigger value="approved" className="text-xs h-8 px-3 font-bold text-green-700">Approved ({approvedDocs.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="my-department">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[13px] font-bold text-foreground">My Department Issued Documents</h4>
                    <Badge variant="outline" className="text-[10px] bg-green-50">{myDeptDocs.length} Active</Badge>
                  </div>
                  <DocumentTable
                    documents={transformAndFilter(myDeptDocs)}
                    onView={handleViewPDF}
                    showActions={true}
                    showLocation={true}
                  />
                </TabsContent>

                <TabsContent value="other-department">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[13px] font-bold text-foreground">Other Department Issued Documents</h4>
                    <Badge variant="outline" className="text-[10px] bg-blue-50">{otherDeptDocs.length} Shared</Badge>
                  </div>
                  <DocumentTable
                    documents={transformAndFilter(otherDeptDocs)}
                    onView={handleViewPDF}
                    showActions={true}
                    showLocation={true}
                  />
                </TabsContent>

                <TabsContent value="pending">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[13px] font-bold text-foreground">Documents Awaiting Your Review</h4>
                    <Badge variant="outline" className="text-[10px] bg-amber-50">{pendingDocs.length} Pending</Badge>
                  </div>
                  {isLoadingDocs ? (
                    <div className="text-center py-8 text-muted-foreground">Loading documents...</div>
                  ) : pendingDocs.length === 0 ? (
                    <div className="border rounded-lg p-12 text-center bg-slate-50/50">
                      <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                      <p className="text-sm text-muted-foreground">No pending documents</p>
                    </div>
                  ) : (
                    <DocumentTable
                      documents={transformAndFilter(pendingDocs)}
                      onView={handleView}
                      onViewWord={handleViewWord}
                      onDownload={handleDownload}
                      onApprove={handleApprove}
                      onDecline={handleDecline}
                      showLocation={true}
                    />
                  )}
                </TabsContent>

                <TabsContent value="approved">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[13px] font-bold text-green-700">Approved Documents (Awaiting Issue by MR)</h4>
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">{approvedDocs.length} Approved</Badge>
                  </div>
                  {approvedDocs.length === 0 ? (
                    <div className="border rounded-lg p-12 text-center bg-slate-50/50">
                      <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                      <p className="text-sm text-muted-foreground">No approved documents</p>
                    </div>
                  ) : (
                    <DocumentTable
                      documents={transformAndFilter(approvedDocs)}
                      onView={handleView}
                      onViewWord={handleViewWord}
                      onDownload={handleDownload}
                      showLocation={true}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </Card>

            <Card className="p-4">
              <h3 className="text-base font-semibold mb-3">Document Workflow</h3>
              <WorkflowProgress currentStep="Approver" />
              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Your Role:</strong> Review documents with auto-generated headers/footers,
                  approve or decline with remarks, and select departments for document sharing.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Note:</strong> Issued documents can be printed only once per system policy.
                </p>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <ActivityFeed activities={activities} maxItems={15} />
          </div>
        </div>
      </div>

      <ApprovalDialog
        open={approveDialogOpen}
        onClose={() => setApproveDialogOpen(false)}
        onApprove={(data) => {
          if (selectedDoc) {
            approveMutation.mutate({
              documentId: selectedDoc.id,
              approvalRemarks: data.remarks,
              departments: data.departments,
              approverName: data.approverName,
            });
          }
          setApproveDialogOpen(false);
        }}
        type="approve"
        title={`Approve: ${selectedDoc?.docName}`}
        approverName={approverName}
        nameFieldLabel="Approved By"
        initialDocNumber={selectedDoc?.docNumber || ""}
        initialSelectedDepartments={selectedDoc?.departments?.map(d => d.id) || []}
      />

      <ApprovalDialog
        open={declineDialogOpen}
        onClose={() => setDeclineDialogOpen(false)}
        onDecline={(remarks) => {
          if (selectedDoc) {
            declineMutation.mutate({
              documentId: selectedDoc.id,
              declineRemarks: remarks,
            });
          }
          setDeclineDialogOpen(false);
        }}
        type="decline"
        title={`Decline: ${selectedDoc?.docName}`}
      />

      <DocumentViewDialog
        document={viewDoc}
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        onDownload={handleDownload}
        onViewPdf={handleViewPDF}
        onViewWord={handleViewWord}
      />

      <WordDocumentViewer
        documentId={wordViewDocId}
        open={wordViewerOpen}
        onOpenChange={setWordViewerOpen}
      />

      <PDFViewer
        documentId={pdfDocId}
        userId={userId}
        open={pdfViewerOpen}
        onClose={() => setPdfViewerOpen(false)}
        documentName={pdfDocName}
      />
    </DashboardLayout >
  );
}
