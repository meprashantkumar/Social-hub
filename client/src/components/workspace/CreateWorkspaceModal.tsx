import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/ui/modal";
import { CreateWorkspaceForm } from "./CreateWorkspaceForm";

export function CreateWorkspaceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create workspace"
      description="Workspaces keep a team's connections, posts, and analytics together."
    >
      <CreateWorkspaceForm
        onCreated={() => {
          onClose();
          navigate("/dashboard");
        }}
      />
    </Modal>
  );
}
