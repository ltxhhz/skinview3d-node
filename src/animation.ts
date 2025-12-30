import { PlayerObject } from 'model.js';

export abstract class PlayerAnimation {
	// 相对倍率
	speed = 1;
	/**
	 * 渲染某一帧的姿态
	 * @param player 播放器对象
	 * @param progress 动画进度，范围 [0, 1]。0代表起点，1代表终点（或循环回起点）
	 */
	protected abstract animate(player: PlayerObject, progress: number): void;

	// 这一层只需要暴露一个接口给外部调用
	public render(player: PlayerObject, progress: number): void {
		// 确保 progress 在 0-1 之间 (可选，视需求而定)
		// const p = progress % 1.0;
		this.animate(player, progress);
	}
}

/**
 * A class that helps you create an animation from a function.
 *
 * @example
 * To create an animation that rotates the player:
 * ```
 * new FunctionAnimation((player, progress) => player.rotation.y = progress)
 * ```
 */
export class FunctionAnimation extends PlayerAnimation {
	fn: (player: PlayerObject, progress: number) => void;

	constructor(fn: (player: PlayerObject, progress: number) => void) {
		super();
		this.fn = fn;
	}

	protected animate(player: PlayerObject, progress: number): void {
		this.fn(player, progress);
	}
}

export class IdleAnimation extends PlayerAnimation {
	protected animate(player: PlayerObject, progress: number): void {
		// Multiply by animation's natural speed
		const t = progress * 2 * Math.PI * this.speed;

		// Arm swing
		const basicArmRotationZ = Math.PI * 0.02;
		player.skin.leftArm.rotation.z = Math.cos(t) * 0.03 + basicArmRotationZ;
		player.skin.rightArm.rotation.z = Math.cos(t + Math.PI) * 0.03 - basicArmRotationZ;

		// Always add an angle for cape around the x axis
		const basicCapeRotationX = Math.PI * 0.06;
		player.cape.rotation.x = Math.sin(t) * 0.01 + basicCapeRotationX;
	}
}

export class WalkingAnimation extends PlayerAnimation {
	/**
	 * Whether to shake head when walking.
	 *
	 * @defaultValue `true`
	 */
	headBobbing: boolean = true;

	protected animate(player: PlayerObject, progress: number): void {
		// 基础周期：0 -> 2PI
		// 所有的动作都基于这个 base
		const t = progress * 2 * Math.PI * this.speed;

		// 肢体摆动 (频率 1x)
		player.skin.leftLeg.rotation.x = Math.sin(t) * 0.5;
		player.skin.rightLeg.rotation.x = Math.sin(t + Math.PI) * 0.5;
		player.skin.leftArm.rotation.x = Math.sin(t + Math.PI) * 0.5;
		player.skin.rightArm.rotation.x = Math.sin(t) * 0.5;
		const basicArmRotationZ = Math.PI * 0.02;
		player.skin.leftArm.rotation.z = Math.cos(t) * 0.03 + basicArmRotationZ;
		player.skin.rightArm.rotation.z = Math.cos(t + Math.PI) * 0.03 - basicArmRotationZ;

		// 头部摇晃 (频率 2x - 保证在 0-1 周期内摇晃整数次)
		// 原版是 /4, /5，这里为了完美闭环，必须设为整数倍
		// 比如设定：走一圈，头晃 2 次
		if (this.headBobbing) {
			// Head shaking with different frequency & amplitude
			player.skin.head.rotation.y = Math.sin(t * 2) * 0.1; // 左右晃
			player.skin.head.rotation.x = Math.sin(t * 4) * 0.05; // 上下晃
		} else {
			player.skin.head.rotation.y = 0;
			player.skin.head.rotation.x = 0;
		}
		// 披风 (频率 1x 或 2x)
		player.cape.rotation.x = Math.sin(t) * 0.06 + Math.PI * 0.06;
	}
}

export class RunningAnimation extends PlayerAnimation {
	protected animate(player: PlayerObject, progress: number): void {
		// 基础周期：0 -> 2PI
		const t = progress * 2 * Math.PI * this.speed + Math.PI * 0.5; // 保留相位偏移

		// Leg swing with larger amplitude
		player.skin.leftLeg.rotation.x = Math.cos(t + Math.PI) * 1.3;
		player.skin.rightLeg.rotation.x = Math.cos(t) * 1.3;

		// Arm swing
		player.skin.leftArm.rotation.x = Math.cos(t) * 1.5;
		player.skin.rightArm.rotation.x = Math.cos(t + Math.PI) * 1.5;

		// 身体跳动 (频率 2x)
		// 跑一步跳一下，左右各一步，所以跳两下 -> 2x
		player.position.y = Math.cos(t * 2);
		// Dodging when running
		player.position.x = Math.cos(t) * 0.15;
		// Slightly tilting when running
		player.rotation.z = Math.cos(t + Math.PI) * 0.01;

		// Apply higher swing frequency, lower amplitude,
		// and greater basic rotation around x axis,
		// to cape when running.
		// 披风 (频率 2x)
		player.cape.rotation.x = Math.sin(t * 2) * 0.1 + Math.PI * 0.3;
		// What about head shaking?
		// You shouldn't glance right and left when running dude :P
	}
}
function clamp(num: number, min: number, max: number): number {
	return num <= min ? min : num >= max ? max : num;
}

export class FlyingAnimation extends PlayerAnimation {
	speed: number = 2;
	protected animate(player: PlayerObject, progress: number): void {
		// Body rotation finishes in 0.5s
		// Elytra expansion finishes in 3.3s

		const t = progress * Math.PI * 2 * this.speed;
		const startProgress = clamp((t * t) / 100, 0, 1);

		player.rotation.x = (startProgress * Math.PI) / 2;
		player.skin.head.rotation.x = startProgress > 0.5 ? Math.PI / 4 - player.rotation.x : 0;

		const basicArmRotationZ = Math.PI * 0.25 * startProgress;
		player.skin.leftArm.rotation.z = basicArmRotationZ;
		player.skin.rightArm.rotation.z = -basicArmRotationZ;

		const elytraRotationX = 0.34906584;
		const elytraRotationZ = Math.PI / 2;
		const interpolation = Math.pow(0.9, t);
		player.elytra.leftWing.rotation.x = elytraRotationX + interpolation * (0.2617994 - elytraRotationX);
		player.elytra.leftWing.rotation.z = elytraRotationZ + interpolation * (0.2617994 - elytraRotationZ);
		player.elytra.updateRightWing();
	}
}

export class WaveAnimation extends PlayerAnimation {
	whichArm: 'left' | 'right' | 'both';
	sameDirection = true;

	constructor(whichArm: 'left' | 'right' | 'both' = 'left') {
		super();
		this.whichArm = whichArm;
	}

	protected animate(player: PlayerObject, progress: number): void {
		const t = progress * 2 * Math.PI * this.speed;

		const targetArm = this.whichArm === 'left' ? player.skin.leftArm : player.skin.rightArm;
		targetArm.rotation.x = 180;
		targetArm.rotation.z = Math.sin(t) * 0.5;
		if (this.whichArm === 'both') {
			player.skin.leftArm.rotation.x = targetArm.rotation.x;
			player.skin.leftArm.rotation.z = this.sameDirection ? targetArm.rotation.z : -Math.sin(t) * 0.5;
		}
	}
}

export class CrouchAnimation extends PlayerAnimation {
	/**
	 * 是否启用平滑过渡。
	 * - false (默认): 像 Minecraft 游戏内一样，瞬间在站立和蹲下间切换。
	 * - true: 平滑地蹲下和起立（适合展示动画）。
	 */
	showProgress: boolean = false;

	/**
	 * 是否保持静止的蹲下状态。
	 * 如果为 true，忽略 progress，始终保持完全蹲下的姿态。
	 */
	isStatic: boolean = false;

	/**
	 * 是否同时播放攻击（挥手）动画
	 */
	isRunningHitAnimation: boolean = false;

	protected animate(player: PlayerObject, progress: number): void {
		// 1. 计算蹲下系数 (crouchFactor)
		// 范围 0.0 (站立) 到 1.0 (完全蹲下)
		let crouchFactor: number;

		if (this.isStatic) {
			crouchFactor = 1.0; // 始终蹲下
		} else {
			// 将 0-1 的进度映射为 0-1-0 的正弦波 (蹲下再站起)
			// progress: 0 -> 0.5 -> 1.0
			// angle:    0 -> PI  -> 2PI
			// sin:      0 -> 1   -> 0
			const t = progress * 2 * Math.PI * this.speed;
			crouchFactor = Math.abs(Math.sin(t / 2));
		}

		// 2. 处理 "瞬间切换" 逻辑 (Minecraft 原版风格)
		if (!this.showProgress && !this.isStatic) {
			// 如果进度 > 0.5 则算蹲下，否则算站立
			crouchFactor = crouchFactor > (this.showProgress ? 0 : 0.4) ? 1.0 : 0.0;
		}

		// --- 应用身体位移和旋转 (使用 crouchFactor 插值) ---

		// 身体前倾
		player.skin.body.rotation.x = 0.4537860552 * crouchFactor;
		// 身体位置调整 (Y轴下降, Z轴后退)
		player.skin.body.position.y = -6 - 2.103677462 * crouchFactor;
		player.skin.body.position.z = 1.3256181 * crouchFactor - 3.4500310377 * crouchFactor;

		// 头部位置 (跟随身体下沉)
		player.skin.head.position.y = -3.618325234674 * crouchFactor;

		// 手臂位置和旋转
		// 基础位置偏移
		const armZ = 3.618325234674 * crouchFactor - 3.4500310377 * crouchFactor;
		const armY = -2 - 2.53943318 * crouchFactor;

		player.skin.leftArm.position.z = armZ;
		player.skin.rightArm.position.z = armZ;
		player.skin.leftArm.position.y = armY;
		player.skin.rightArm.position.y = armY;

		// 手臂旋转 (保持垂直或跟随身体)
		player.skin.leftArm.rotation.x = 0.410367746202 * crouchFactor;
		player.skin.rightArm.rotation.x = player.skin.leftArm.rotation.x;

		// 手臂微张
		player.skin.leftArm.rotation.z = 0.1;
		player.skin.rightArm.rotation.z = -0.1;

		// 腿部位置
		player.skin.leftLeg.position.z = -3.4500310377 * crouchFactor;
		player.skin.rightLeg.position.z = -3.4500310377 * crouchFactor;

		// 披风 (Cape) 调整
		player.cape.position.y = 8 - 1.851236166577372 * crouchFactor;
		player.cape.position.z = -2 + 3.786619432 * crouchFactor - 3.4500310377 * crouchFactor;
		player.cape.rotation.x = (10.8 * Math.PI) / 180 + 0.294220265771 * crouchFactor;

		// --- 鞘翅 (Elytra) 逻辑重写 ---
		// 移除 isCrouched 状态，直接基于 crouchFactor 计算位置
		player.elytra.position.x = player.cape.position.x;
		player.elytra.position.y = player.cape.position.y;
		player.elytra.position.z = player.cape.position.z;
		player.elytra.rotation.x = player.cape.rotation.x - (10.8 * Math.PI) / 180;

		// 鞘翅开合角度：
		// 站立时 (crouchFactor=0) -> 0.26 rad
		// 蹲下时 (crouchFactor=1) -> 0.72 rad (根据原代码逻辑推算)
		// 使用线性插值替代原有的复杂状态机
		const wingRotZ = 0.26179944 + 0.4582006 * crouchFactor;
		player.elytra.leftWing.rotation.z = wingRotZ;
		player.elytra.updateRightWing();

		// --- 攻击 (Hit) 动画逻辑 ---
		if (this.isRunningHitAnimation) {
			// 为了保证循环完美，攻击频率必须是主循环的整数倍。
			// 比如主循环是蹲下再起来 (1次)，期间挥动 2 次手。
			const hitCycles = Math.round(2 * this.speed);
			const t = progress * 2 * Math.PI * hitCycles;

			// 基础手臂旋转 Z
			const basicArmRotationZ = 0.01 * Math.PI + 0.06;

			// 右手攻击
			// 叠加在蹲下的旋转基础上
			const crouchOffsetX = 0.4537860552 * crouchFactor;

			// Right Arm Swing
			player.skin.rightArm.rotation.x = -crouchOffsetX + 2 * Math.sin(t + Math.PI) * 0.3 - crouchOffsetX;
			player.skin.rightArm.rotation.z = -Math.cos(t) * 0.403 + basicArmRotationZ;

			// Body Twist
			player.skin.body.rotation.y = -Math.cos(t) * 0.06;

			// Left Arm Compensation (摆动平衡)
			player.skin.leftArm.rotation.x = Math.sin(t + Math.PI) * 0.077 + 0.47 * crouchFactor;
			player.skin.leftArm.rotation.z = -Math.cos(t) * 0.015 + 0.13 - 0.05 * (1 - crouchFactor);

			// 左手位置微调 (仅在站立时明显，原代码逻辑)
			// 使用 (1 - crouchFactor) 来限制仅在站立附近生效
			const standFactor = 1 - crouchFactor;
			player.skin.leftArm.position.z += Math.cos(t) * 0.3 * standFactor;
			player.skin.leftArm.position.x = 5 - Math.cos(t) * 0.05 * standFactor;
		}
	}
}
export class HitAnimation extends PlayerAnimation {
	speed: number = 2;
	protected animate(player: PlayerObject, progress: number): void {
		const t = progress * Math.PI * 2 * this.speed;
		player.skin.rightArm.rotation.x = -0.4537860552 * 2 + 2 * Math.sin(t + Math.PI) * 0.3;
		const basicArmRotationZ = 0.01 * Math.PI + 0.06;
		player.skin.rightArm.rotation.z = -Math.cos(t) * 0.403 + basicArmRotationZ;
		player.skin.body.rotation.y = -Math.cos(t) * 0.06;
		player.skin.leftArm.rotation.x = Math.sin(t + Math.PI) * 0.077;
		player.skin.leftArm.rotation.z = -Math.cos(t) * 0.015 + 0.13 - 0.05;
		player.skin.leftArm.position.z = Math.cos(t) * 0.3;
		player.skin.leftArm.position.x = 5 - Math.cos(t) * 0.05;
	}
}
