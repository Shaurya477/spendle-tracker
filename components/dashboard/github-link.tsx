import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { REPO_URL } from "@/lib/pendle/config";
import { GitHubMark } from "./github-mark";

export { GitHubMark };

export function GitHubLink() {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "font-mono text-xs")}
    >
      <GitHubMark />
      Source
    </a>
  );
}
