import { Composition } from "remotion";
import { StaffKnowledgeOnboarding } from "./StaffKnowledgeOnboarding";

export const RemotionRoot = () => {
  return (
    <Composition
      id="StaffKnowledgeOnboarding"
      component={StaffKnowledgeOnboarding}
      durationInFrames={2700}
      fps={30}
      width={1280}
      height={720}
    />
  );
};

