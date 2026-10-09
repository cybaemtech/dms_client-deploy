import { useState } from "react";
import { FileText, CheckCircle, XCircle, Send, Clock, ChevronDown, ChevronUp, Activity as ActivityIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface Activity {
  id: string;
  type: "created" | "approved" | "declined" | "issued" | "pending";
  docName: string;
  docNumber?: string;
  userName: string;
  timestamp: string;
  remarks?: string;
  departmentName?: string;
  isMyDept?: boolean;
}

interface ActivityFeedProps {
  activities: Activity[];
  maxItems?: number;
}

export function formatActivityTimestamp(timestamp?: string): string {
  if (!timestamp) return "";
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return timestamp;
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    if (isToday) return `Today at ${timeStr}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${timeStr}`;
    }
    return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} at ${timeStr}`;
  } catch {
    return timestamp;
  }
}

export function buildActivitiesFromDocs(
  docs: any[],
  isMyDeptFn: (doc: any) => boolean
): Activity[] {
  const activities: Activity[] = [];
  const seenIds = new Set<string>();

  for (const doc of docs) {
    if (!doc || !doc.id || seenIds.has(doc.id)) continue;
    seenIds.add(doc.id);

    const isMyDept = isMyDeptFn(doc);
    let deptName = doc.creatorDepartmentName || "";
    if (!deptName && doc.departments && doc.departments.length > 0) {
      deptName = doc.departments[0].name || doc.departments[0].department?.name || "";
    }
    if (!deptName) {
      deptName = isMyDept ? "My Department" : "Other Department";
    }

    const status = (doc.status || "").toLowerCase();

    // Issued event
    if (status === "issued" || doc.issuedAt || doc.dateOfIssue) {
      activities.push({
        id: `${doc.id}-issued`,
        type: "issued",
        docName: doc.docName || "Untitled Document",
        docNumber: doc.docNumber,
        userName: doc.issuerName || "Document Issuer",
        timestamp: doc.issuedAt || doc.dateOfIssue || doc.updatedAt || doc.createdAt || new Date().toISOString(),
        remarks: doc.issueRemarks,
        departmentName: deptName,
        isMyDept,
      });
    }

    // Approved event
    if (status === "approved" || doc.approvedAt || (status === "issued" && doc.approverName)) {
      activities.push({
        id: `${doc.id}-approved`,
        type: "approved",
        docName: doc.docName || "Untitled Document",
        docNumber: doc.docNumber,
        userName: doc.approverName || "Document Approver",
        timestamp: doc.approvedAt || (status === "approved" ? doc.updatedAt : null) || doc.createdAt || new Date().toISOString(),
        remarks: doc.approvalRemarks,
        departmentName: deptName,
        isMyDept,
      });
    }

    // Declined event
    if (status === "declined" || doc.declinedAt) {
      activities.push({
        id: `${doc.id}-declined`,
        type: "declined",
        docName: doc.docName || "Untitled Document",
        docNumber: doc.docNumber,
        userName: doc.declinerName || doc.approverName || "Document Approver",
        timestamp: doc.declinedAt || doc.updatedAt || doc.createdAt || new Date().toISOString(),
        remarks: doc.declineRemarks,
        departmentName: deptName,
        isMyDept,
      });
    }

    // Created / Pending event
    if (status === "pending") {
      activities.push({
        id: `${doc.id}-pending`,
        type: "pending",
        docName: doc.docName || "Untitled Document",
        docNumber: doc.docNumber,
        userName: doc.preparerName || doc.preparedBy || "Document Creator",
        timestamp: doc.createdAt || new Date().toISOString(),
        departmentName: deptName,
        isMyDept,
      });
    } else {
      activities.push({
        id: `${doc.id}-created`,
        type: "created",
        docName: doc.docName || "Untitled Document",
        docNumber: doc.docNumber,
        userName: doc.preparerName || doc.preparedBy || "Document Creator",
        timestamp: doc.createdAt || new Date().toISOString(),
        departmentName: deptName,
        isMyDept,
      });
    }
  }

  return activities.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export default function ActivityFeed({ activities = [], maxItems = 15 }: ActivityFeedProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filterTab, setFilterTab] = useState<"my-dept" | "other-dept">("my-dept");

  const getIcon = (type: Activity["type"]) => {
    switch (type) {
      case "created":
        return (
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-3.5 h-3.5 text-blue-600" />
          </div>
        );
      case "approved":
        return (
          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-3.5 h-3.5 text-green-600" />
          </div>
        );
      case "declined":
        return (
          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
          </div>
        );
      case "issued":
        return (
          <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
            <Send className="w-3.5 h-3.5 text-purple-600" />
          </div>
        );
      case "pending":
        return (
          <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
        );
    }
  };

  const getActionText = (type: Activity["type"]) => {
    switch (type) {
      case "created":
        return "created";
      case "approved":
        return "approved";
      case "declined":
        return "declined";
      case "issued":
        return "issued";
      case "pending":
        return "submitted for review";
    }
  };

  const myDeptCount = activities.filter((a) => a.isMyDept === true).length;
  const otherDeptCount = activities.filter((a) => a.isMyDept === false).length;

  const filteredActivities = activities.filter((a) =>
    filterTab === "my-dept" ? a.isMyDept === true : a.isMyDept === false
  );

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm" data-testid="card-activity-feed">
      <div className="p-3 bg-white border-b border-slate-100">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between hover:opacity-80 transition-opacity border-none bg-transparent p-0 text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-blue-50 text-blue-600">
              <ActivityIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
                Recent Activity
                <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-slate-200">
                  {activities.length}
                </span>
              </h3>
              <p className="text-[10px] text-muted-foreground">My Dept & Other Dept updates</p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {isExpanded && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md mt-2.5">
            <button
              type="button"
              onClick={() => setFilterTab("my-dept")}
              className={`flex-1 text-[10px] py-1 px-1 rounded transition-colors text-center font-semibold flex items-center justify-center gap-1 ${
                filterTab === "my-dept"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <span>My Dept</span>
              <span
                className={`text-[9px] px-1 py-0.1 rounded font-bold ${
                  filterTab === "my-dept" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
                }`}
              >
                {myDeptCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("other-dept")}
              className={`flex-1 text-[10px] py-1 px-1 rounded transition-colors text-center font-semibold flex items-center justify-center gap-1 ${
                filterTab === "other-dept"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <span>Other Dept</span>
              <span
                className={`text-[9px] px-1 py-0.1 rounded font-bold ${
                  filterTab === "other-dept" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700"
                }`}
              >
                {otherDeptCount}
              </span>
            </button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="p-3 max-h-[440px] overflow-y-auto bg-slate-50/50 divide-y divide-slate-100">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-6 px-3">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground font-medium">
                {filterTab === "my-dept"
                  ? "No recent activities from your department."
                  : "No recent activities from other departments."}
              </p>
            </div>
          ) : (
            filteredActivities.slice(0, maxItems).map((act) => (
              <div
                key={act.id}
                className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-2.5 hover:bg-white/60 -mx-1 px-1 rounded-md transition-colors"
                data-testid={`activity-${act.id}`}
              >
                <div className="mt-0.5">{getIcon(act.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-[11px] text-foreground">{act.userName}</span>
                    <span className="text-[10px] text-muted-foreground">{getActionText(act.type)}</span>
                    {act.isMyDept !== undefined && (
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${
                          act.isMyDept
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-purple-50 text-purple-700 border-purple-200"
                        }`}
                      >
                        {act.isMyDept ? "My Dept" : "Other Dept"}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-slate-800 break-words mt-0.5">
                    {act.docNumber && (
                      <span className="font-mono text-[10px] text-slate-500 mr-1 font-semibold bg-slate-100 px-1 py-0.2 rounded">
                        [{act.docNumber}]
                      </span>
                    )}
                    {act.docName}
                  </p>
                  {act.departmentName && (
                    <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                      <span className="text-slate-400">Dept:</span>
                      <span className="font-medium text-slate-700">{act.departmentName}</span>
                    </p>
                  )}
                  {act.remarks && (
                    <p className="text-[10px] text-slate-600 mt-1 italic leading-tight bg-white p-1.5 rounded border border-slate-200/80 shadow-2xs">
                      "{act.remarks}"
                    </p>
                  )}
                  <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {formatActivityTimestamp(act.timestamp)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}
