"use client";

import { GitHubIcon } from "@/components/icons/github-icon";
import { Button } from "@/components/ui/button";

const GITHUB_REPO_URL =
  "https://github.com/membranehq/self-integrating-workflow-builder";

export function GitHubStarsButton() {
  return (
    <Button asChild className="h-9 px-2 sm:px-3" size="sm" variant="ghost">
      <a
        className="flex items-center"
        href={GITHUB_REPO_URL}
        rel="noopener noreferrer"
        target="_blank"
      >
        <GitHubIcon className="size-4.5" />
      </a>
    </Button>
  );
}
