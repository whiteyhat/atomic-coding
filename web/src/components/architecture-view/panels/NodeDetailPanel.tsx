"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import type { Node } from "@xyflow/react";
import {
  Activity,
  ArrowRight,
  Bot,
  Hammer,
  Paintbrush,
  ShieldCheck,
  X,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/dashboard";
import type { ArchitectureNodeData } from "../hooks/useArchitectureState";

const AGENT_ICONS = {
  jarvis: Bot,
  forge: Hammer,
  pixel: Paintbrush,
  checker: ShieldCheck,
} as const;

function Section({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/32">
        {label}
      </p>
      {children}
    </section>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
      <span className="text-[11px] uppercase tracking-[0.16em] text-white/35">
        {label}
      </span>
      <span className="text-[11px] font-medium text-white/76">{value}</span>
    </div>
  );
}

function LinkPill({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-white/72 transition hover:border-white/18 hover:bg-white/[0.09] hover:text-white"
    >
      {label}
      {onClick ? <ArrowRight className="size-3" /> : null}
    </button>
  );
}

function PlatformDetails({
  data,
  onNavigateToNode,
}: {
  data: Extract<ArchitectureNodeData, { type: "platform" }>;
  onNavigateToNode?: (nodeId: string) => void;
}) {
  return (
    <>
      <div className="rounded-[1.65rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-white/10 bg-black/20 p-3">
            <Image
              src={data.iconSrc}
              alt={`${data.label} icon`}
              width={40}
              height={40}
              className="h-full w-full rounded-[1rem] object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-white">{data.label}</h2>
            <p className="mt-2 text-sm leading-6 text-white/62">{data.description}</p>
          </div>
        </div>
      </div>

      <Section label="Context">
        {data.lastEditedGame ? (
          <>
            <DetailRow label="Last edited game" value={data.lastEditedGame.name} />
            <DetailRow
              label="Last update"
              value={formatRelativeTime(data.lastEditedGame.updatedAt)}
            />
          </>
        ) : (
          <p className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-sm text-white/58">
            No recent game context is available yet. The topology stays static until a
            game is selected in the broader product flow.
          </p>
        )}
      </Section>

      <Section label="Platform counts">
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Agents" value={String(data.counts.agents)} />
          <DetailRow label="Services" value={String(data.counts.services)} />
        </div>
      </Section>

      <Section label="Runtime surfaces">
        <div className="space-y-2">
          {data.runtimeSurfaces.map((surface) => (
            <div
              key={surface.label}
              className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3"
            >
              <p className="text-sm font-medium text-white/82">{surface.label}</p>
              <p className="mt-1 text-sm leading-6 text-white/56">{surface.detail}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Connected agents">
        <div className="flex flex-wrap gap-2">
          {data.connectedAgents.map((agent) => (
            <LinkPill
              key={agent.id}
              label={agent.label}
              onClick={
                onNavigateToNode ? () => onNavigateToNode(agent.id) : undefined
              }
            />
          ))}
        </div>
      </Section>
    </>
  );
}

function AgentDetails({
  data,
  onNavigateToNode,
}: {
  data: Extract<ArchitectureNodeData, { type: "agent" }>;
  onNavigateToNode?: (nodeId: string) => void;
}) {
  const Icon = AGENT_ICONS[data.id];

  return (
    <>
      <div className="rounded-[1.65rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] p-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] border border-white/10 bg-black/20"
            style={{ color: data.accentColor }}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">{data.label}</h2>
              <span
                className="size-2 rounded-full"
                style={{ background: data.accentColor }}
              />
            </div>
            <p className="mt-1 text-sm text-white/62">{data.role}</p>
            <p className="mt-3 text-sm leading-6 text-white/56">{data.description}</p>
          </div>
        </div>
      </div>

      <Section label="Runtime">
        <DetailRow label="Model" value={data.model} />
        <div className="flex flex-wrap gap-2">
          {data.toolAccess.map((tool) => (
            <LinkPill key={tool} label={tool} />
          ))}
        </div>
      </Section>

      <Section label="Owned tasks">
        <div className="space-y-2">
          {data.ownedTasks.map((task) => (
            <div
              key={task}
              className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5 text-sm text-white/72"
            >
              {task}
            </div>
          ))}
        </div>
      </Section>

      <Section label="Top skills">
        <div className="flex flex-wrap gap-2">
          {data.skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-white/72"
            >
              {skill}
            </span>
          ))}
        </div>
      </Section>

      <Section label="Connected services">
        <div className="flex flex-wrap gap-2">
          {data.services.map((service) => (
            <LinkPill
              key={service.id}
              label={service.label}
              onClick={
                onNavigateToNode ? () => onNavigateToNode(service.id) : undefined
              }
            />
          ))}
        </div>
      </Section>
    </>
  );
}

function ServiceDetails({
  data,
  onNavigateToNode,
}: {
  data: Extract<ArchitectureNodeData, { type: "service" }>;
  onNavigateToNode?: (nodeId: string) => void;
}) {
  return (
    <>
      <div className="rounded-[1.65rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] border border-white/10 bg-black/20 text-xs font-semibold text-white/82">
            {data.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white">{data.label}</h2>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
                {data.category}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/58">{data.description}</p>
          </div>
        </div>
      </div>

      <Section label="Service details">
        <DetailRow label="Owner" value={data.owner.label} />
        <DetailRow label="Runtime type" value={data.runtimeType} />
      </Section>

      <Section label="Notes">
        <div className="space-y-2">
          {data.notes.map((note) => (
            <div
              key={note}
              className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5 text-sm leading-6 text-white/62"
            >
              {note}
            </div>
          ))}
        </div>
      </Section>

      <Section label="Owner agent">
        <div className="flex flex-wrap gap-2">
          <LinkPill
            label={data.owner.label}
            onClick={
              onNavigateToNode ? () => onNavigateToNode(data.owner.id) : undefined
            }
          />
        </div>
      </Section>
    </>
  );
}

interface NodeDetailPanelProps {
  node: Node<ArchitectureNodeData> | null;
  onClose: () => void;
  onNavigateToNode?: (nodeId: string) => void;
}

export function NodeDetailPanel({
  node,
  onClose,
  onNavigateToNode,
}: NodeDetailPanelProps) {
  return (
    <AnimatePresence>
      {node ? (
        <>
          <motion.button
            type="button"
            aria-label="Close architecture detail panel"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 bg-black/40 backdrop-blur-sm md:hidden"
          />

          <motion.aside
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute inset-x-3 bottom-3 top-24 z-20 flex flex-col rounded-[2rem] border border-white/10 bg-[#18080d]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:inset-y-4 md:left-auto md:right-4 md:w-[380px]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                  <Activity className="size-4 text-rose-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Node detail</p>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/32">
                    {node.data.type}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/56 transition hover:bg-white/[0.1] hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="scrollbar-hide flex-1 space-y-4 overflow-y-auto pr-1">
              {node.data.type === "platform" ? (
                <PlatformDetails
                  data={node.data}
                  onNavigateToNode={onNavigateToNode}
                />
              ) : null}

              {node.data.type === "agent" ? (
                <AgentDetails
                  data={node.data}
                  onNavigateToNode={onNavigateToNode}
                />
              ) : null}

              {node.data.type === "service" ? (
                <ServiceDetails
                  data={node.data}
                  onNavigateToNode={onNavigateToNode}
                />
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
